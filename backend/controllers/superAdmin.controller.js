const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 0. DEDICATED SUPER ADMIN AUTHENTICATION
// ================================================================
exports.superAdminLogin = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Identifier aur Password dono required hain.' });
  }

  try {
    const cleanId = String(identifier).trim().toLowerCase();

    const query = `
      SELECT id, hash_id, name, email, phone, password_hash, status, is_super_admin
      FROM users
      WHERE (LOWER(email) = $1 OR phone = $1) AND deleted_at IS NULL;
    `;
    const { rows } = await db.query(query, [cleanId]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Is account ke paas Super Admin rights nahi hain.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Super Admin account deactivated hai.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET server environment me configure nahi hai.');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        userHashId: user.hash_id,
        orgId: null,
        branchId: null,
        role: 'super_admin',
        roles: ['super_admin'],
        isSuperAdmin: true,
        is_super_admin: true
      },
      secret,
      { expiresIn: '12h', algorithm: 'HS256' }
    );

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    return res.status(200).json({
      success: true,
      message: 'Super Admin access granted.',
      token,
      admin: {
        id: user.id,
        hash_id: user.hash_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'super_admin',
        isSuperAdmin: true
      }
    });
  } catch (err) {
    console.error('Super Admin Login Error:', err);
    return res.status(500).json({ success: false, message: 'Internal authentication error.', error: err.message });
  }
};

// ================================================================
// 1. EXECUTIVE KPI DASHBOARD
// ================================================================
exports.getPlatformDashboard = async (req, res) => {
  try {
    const orgQuery = `
      SELECT 
        COUNT(*) AS total_gyms,
        COUNT(*) FILTER (WHERE status = 'active') AS active_gyms,
        COUNT(*) FILTER (WHERE status = 'trial') AS trial_gyms,
        COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_gyms,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_gyms
      FROM organizations;
    `;
    const orgRes = await db.query(orgQuery);

    const memQuery = `SELECT COUNT(*) AS total_platform_members FROM members WHERE status = 'active' AND deleted_at IS NULL;`;
    const memRes = await db.query(memQuery);

    const branchQuery = `SELECT COUNT(*) AS total_branches FROM branches WHERE deleted_at IS NULL;`;
    const branchRes = await db.query(branchQuery);

    const finQuery = `
      SELECT 
        COALESCE(SUM(amount), 0) AS total_saas_collected,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS current_month_collected
      FROM saas_payments 
      WHERE status = 'success';
    `;
    const finRes = await db.query(finQuery);

    const expQuery = `
      SELECT 
        s.id, s.end_date, s.trial_end_date, s.status, o.id AS org_id, o.name AS gym_name, p.name AS plan_name
      FROM saas_subscriptions s
      JOIN organizations o ON s.organization_id = o.id
      JOIN saas_plans p ON s.plan_id = p.id
      WHERE (
        (s.status = 'trial' AND s.trial_end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days'))
        OR (s.status = 'active' AND s.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days'))
      )
      ORDER BY COALESCE(s.end_date, s.trial_end_date) ASC
      LIMIT 10;
    `;
    const expRes = await db.query(expQuery);

    const planDistQuery = `
      SELECT p.name AS plan_name, COUNT(s.id) AS subscriber_count
      FROM saas_plans p
      LEFT JOIN saas_subscriptions s ON s.plan_id = p.id AND s.status IN ('trial', 'active')
      GROUP BY p.name;
    `;
    const planDistRes = await db.query(planDistQuery);

    return res.status(200).json({
      success: true,
      data: {
        gyms: orgRes.rows[0],
        total_active_members: parseInt(memRes.rows[0].total_platform_members, 10),
        total_branches: parseInt(branchRes.rows[0].total_branches, 10),
        financials: {
          total_revenue: parseFloat(finRes.rows[0].total_saas_collected),
          mrr: parseFloat(finRes.rows[0].current_month_collected)
        },
        plan_distribution: planDistRes.rows,
        expiring_soon: expRes.rows
      }
    });
  } catch (error) {
    console.error('Super Admin Dashboard Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. TENANT DIRECTORY & CONTROLS
// ================================================================
exports.getAllGyms = async (req, res) => {
  try {
    const query = `
      SELECT 
        o.id,
        o.hash_id,
        o.name,
        o.slug,
        o.status,
        o.created_at,
        u.id AS owner_id,
        u.name AS owner_name,
        u.email AS owner_email,
        u.phone AS owner_phone,
        COUNT(DISTINCT b.id) AS branch_count,
        COUNT(DISTINCT m.id) FILTER (WHERE m.deleted_at IS NULL) AS member_count,
        sub.status AS subscription_status,
        sub.end_date AS sub_end_date,
        sub.trial_end_date,
        p.name AS current_plan,
        p.max_branches,
        p.max_members
      FROM organizations o
      LEFT JOIN users u ON o.owner_user_id = u.id
      LEFT JOIN branches b ON o.id = b.organization_id AND b.deleted_at IS NULL
      LEFT JOIN members m ON o.id = m.organization_id
      LEFT JOIN LATERAL (
        SELECT id, plan_id, status, end_date, trial_end_date 
        FROM saas_subscriptions 
        WHERE organization_id = o.id 
        ORDER BY id DESC LIMIT 1
      ) sub ON TRUE
      LEFT JOIN saas_plans p ON sub.plan_id = p.id
      GROUP BY o.id, u.id, sub.status, sub.end_date, sub.trial_end_date, p.name, p.max_branches, p.max_members
      ORDER BY o.id DESC;
    `;
    const { rows } = await db.query(query);
    return res.status(200).json({ success: true, count: rows.length, gyms: rows });
  } catch (error) {
    console.error('Get All Gyms Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.toggleGymStatus = async (req, res) => {
  const { organization_id, status } = req.body;

  if (!organization_id || !status) {
    return res.status(400).json({ success: false, message: 'organization_id aur status required hain.' });
  }

  const allowedStatuses = ['active', 'suspended', 'trial', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status type provided.' });
  }

  try {
    const query = `
      UPDATE organizations 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING id, hash_id, name, status;
    `;
    const { rows } = await db.query(query, [status, organization_id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Gym Organization nahi mili.' });
    }

    return res.status(200).json({
      success: true,
      message: `Gym "${rows[0].name}" status ab "${rows[0].status}" kar diya gaya hai.`,
      gym: rows[0]
    });
  } catch (error) {
    console.error('Toggle Status Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.extendTrial = async (req, res) => {
  const { organization_id, extra_days = 7 } = req.body;

  if (!organization_id) {
    return res.status(400).json({ success: false, message: 'organization_id required hai.' });
  }

  try {
    const query = `
      UPDATE saas_subscriptions
      SET trial_end_date = COALESCE(trial_end_date, CURRENT_DATE) + ($1 || ' days')::INTERVAL,
          status = 'trial',
          updated_at = NOW()
      WHERE organization_id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [extra_days, organization_id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription record nahi mila.' });
    }

    await db.query(`UPDATE organizations SET status = 'trial' WHERE id = $1`, [organization_id]);

    return res.status(200).json({
      success: true,
      message: `Trial successfully ${extra_days} dino ke liye extend ho gaya.`,
      subscription: rows[0]
    });
  } catch (error) {
    console.error('Extend Trial Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. SECURE GHOST IMPERSONATION
// ================================================================
exports.impersonateTenant = async (req, res) => {
  const superAdminId = req.user.userId || req.user.id;
  const { organization_id, reason = 'SuperAdmin customer technical audit' } = req.body;

  if (!organization_id) {
    return res.status(400).json({ success: false, message: 'organization_id zaroori hai.' });
  }

  try {
    const ownerRes = await db.query(
      `SELECT u.id, u.hash_id, u.name, u.email, u.phone, u.organization_id, o.name AS gym_name
       FROM users u 
       JOIN organizations o ON o.owner_user_id = u.id 
       WHERE o.id = $1`,
      [organization_id]
    );

    if (ownerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Is gym ka designated owner record nahi mila.' });
    }
    const targetUser = ownerRes.rows[0];

    const branchRes = await db.query(
      `SELECT branch_id FROM user_branches WHERE user_id = $1 LIMIT 1`,
      [targetUser.id]
    );
    const branchId = branchRes.rows[0]?.branch_id || null;

    const logHashId = generateHashId('imp_');
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || null;

    await db.query(
      `INSERT INTO saas_impersonation_logs (
        hash_id, super_admin_user_id, target_user_id, organization_id, reason, ip_address, user_agent, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [logHashId, superAdminId, targetUser.id, organization_id, reason, ipAddress, userAgent]
    );

    const secret = process.env.JWT_SECRET;
    const token = jwt.sign(
      {
        userId: targetUser.id,
        userHashId: targetUser.hash_id,
        orgId: targetUser.organization_id,
        branchId: branchId,
        role: 'owner',
        roles: ['owner'],
        isSuperAdmin: false,
        isImpersonated: true,
        impersonatedBy: superAdminId
      },
      secret,
      { expiresIn: '2h', algorithm: 'HS256' }
    );

    return res.status(200).json({
      success: true,
      message: `Impersonation successful. Redirecting to "${targetUser.gym_name}"...`,
      token,
      user: {
        id: targetUser.id,
        hash_id: targetUser.hash_id,
        name: targetUser.name,
        email: targetUser.email,
        phone: targetUser.phone,
        role: 'owner',
        role_name: 'Owner (Audited)',
        branch_id: branchId,
        is_impersonated: true
      }
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. GLOBAL ANNOUNCEMENTS
// ================================================================
exports.getAnnouncements = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, u.name AS author_name 
       FROM platform_announcements a 
       LEFT JOIN users u ON a.created_by = u.id 
       ORDER BY a.id DESC;`
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.createAnnouncement = async (req, res) => {
  const userId = req.user.userId || req.user.id;
  const { title, message, banner_type = 'info', target_plan_id, expires_at } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Title aur message required hain.' });
  }

  try {
    const hashId = generateHashId('anc_');
    const query = `
      INSERT INTO platform_announcements (
        hash_id, title, message, banner_type, target_plan_id, created_by, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, title.trim(), message.trim(), banner_type,
      target_plan_id ? parseInt(target_plan_id, 10) : null,
      userId, expires_at || null
    ]);
    return res.status(201).json({ success: true, message: 'Platform broadcast created.', announcement: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.toggleAnnouncementStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `UPDATE platform_announcements SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.status(200).json({ success: true, announcement: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 5. GLOBAL PLATFORM CONFIGURATION
// ================================================================
exports.getPlatformSettings = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM platform_settings LIMIT 1;');
    return res.status(200).json({ success: true, settings: rows[0] || {} });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.updatePlatformSettings = async (req, res) => {
  const { platform_name, default_trial_days, maintenance_mode, support_email, support_phone, settings } = req.body;

  try {
    const query = `
      UPDATE platform_settings
      SET platform_name = COALESCE($1, platform_name),
          default_trial_days = COALESCE($2, default_trial_days),
          maintenance_mode = COALESCE($3, maintenance_mode),
          support_email = COALESCE($4, support_email),
          support_phone = COALESCE($5, support_phone),
          settings = COALESCE($6, settings),
          updated_at = NOW()
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      platform_name, default_trial_days, maintenance_mode, support_email, support_phone,
      settings ? JSON.stringify(settings) : null
    ]);
    return res.status(200).json({ success: true, message: 'Platform settings updated successfully.', settings: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
// ================================================================
// 6. SUBSCRIPTION ONBOARDING APPROVAL QUEUE
// ================================================================

// 1. Fetch all pending gym subscriptions with owner, branch & order details
// ================================================================
// 6. SUBSCRIPTION ONBOARDING APPROVAL QUEUE
// ================================================================

exports.getPendingSubscriptions = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id AS subscription_id,
        s.hash_id AS subscription_hash,
        s.status::text AS subscription_status,
        s.start_date,
        s.end_date,
        s.trial_end_date,
        s.created_at AS requested_at,
        o.id AS organization_id,
        o.hash_id AS organization_hash,
        o.name AS gym_name,
        o.slug AS gym_slug,
        o.legal_name,
        o.tax_id_gst,
        o.status::text AS org_status,
        u.id AS owner_id,
        u.name AS owner_name,
        u.email AS owner_email,
        u.phone AS owner_phone,
        b.name AS primary_branch_name,
        b.city AS branch_city,
        b.state AS branch_state,
        b.phone AS branch_phone,
        p.id AS plan_id,
        p.name AS plan_name,
        p.monthly_price,
        p.yearly_price,
        p.max_branches,
        p.max_members,
        p.max_users,
        inv.invoice_number,
        inv.amount AS base_amount,
        inv.tax_amount,
        inv.total_amount,
        inv.status::text AS invoice_status
      FROM saas_subscriptions s
      JOIN organizations o ON s.organization_id = o.id
      JOIN users u ON o.owner_user_id = u.id
      LEFT JOIN branches b ON b.organization_id = o.id AND b.code = 'MAIN-01'
      JOIN saas_plans p ON s.plan_id = p.id
      LEFT JOIN LATERAL (
        SELECT invoice_number, amount, tax_amount, total_amount, status
        FROM saas_invoices
        WHERE subscription_id = s.id
        ORDER BY id DESC LIMIT 1
      ) inv ON TRUE
      WHERE s.status::text IN ('trial', 'pending_approval') 
        AND o.status::text IN ('trial', 'pending_approval')
      ORDER BY s.id DESC;
    `;
    const { rows } = await db.query(query);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending queue.', error: error.message });
  }
};

// 2. Action: Verify, Approve & Activate Subscription
exports.processSubscriptionApproval = async (req, res) => {
  const { subscription_id, organization_id, action, rejection_reason } = req.body;
  // action = 'approve' | 'reject'

  if (!subscription_id || !organization_id || !action) {
    return res.status(400).json({ success: false, message: 'subscription_id, organization_id aur action mandatory hain.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    if (action === 'approve') {
      // 1. Activate Subscription (Set 30-day or active cycle)
      await client.query(
        `UPDATE saas_subscriptions 
         SET status = 'active', 
             start_date = CURRENT_DATE,
             end_date = CURRENT_DATE + INTERVAL '30 days',
             updated_at = NOW() 
         WHERE id = $1 AND organization_id = $2`,
        [subscription_id, organization_id]
      );

      // 2. Activate Organization
      await client.query(
        `UPDATE organizations SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [organization_id]
      );

      // 3. Mark Invoice as Paid
      await client.query(
        `UPDATE saas_invoices SET status = 'paid' WHERE subscription_id = $1`,
        [subscription_id]
      );

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Subscription successfully approved! Gym portal 100% active kar diya gaya hai.'
      });
    } else if (action === 'reject') {
      // Reject / Suspend Organization
      await client.query(
        `UPDATE saas_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
        [subscription_id, organization_id]
      );

      await client.query(
        `UPDATE organizations SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
        [organization_id]
      );

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `Subscription request reject kar di gayi. Reason: ${rejection_reason || 'Incomplete verification'}`
      });
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid action provided.' });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing approval:', error);
    return res.status(500).json({ success: false, message: 'Approval execution failed.', error: error.message });
  } finally {
    client.release();
  }
};