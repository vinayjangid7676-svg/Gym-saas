const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const jwt = require('jsonwebtoken');

const generateCleanSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .slice(0, 70);
};

exports.registerGymOwner = async (req, res) => {
  const client = await db.connect();

  const {
    gym_name,
    legal_name,
    tax_id_gst,
    owner_name,
    phone,
    email,
    password,
    branch_name,
    address,
    city,
    state,
    pincode,
    plan_id,
    billing_cycle = 'monthly',
    payment_method = 'trial'
  } = req.body;

  if (!gym_name || !owner_name || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Gym Name, Owner Name, Phone aur Password required hain.'
    });
  }

  const cleanPhone = String(phone).trim();
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  try {
    await client.query('BEGIN');

    const userCheck = await client.query(
      `SELECT id FROM users WHERE phone = $1 OR (email IS NOT NULL AND email = $2)`,
      [cleanPhone, cleanEmail]
    );

    if (userCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Ye mobile number ya email pehle se registered hai. Sign In karein.'
      });
    }

    let targetPlan = null;
    if (plan_id) {
      const planRes = await client.query(
        `SELECT * FROM saas_plans WHERE (hash_id = $1 OR lower(name) = lower($1) OR id::text = $1) AND is_active = TRUE LIMIT 1`,
        [String(plan_id).trim()]
      );
      if (planRes.rows.length > 0) {
        targetPlan = planRes.rows[0];
      }
    }

    if (!targetPlan) {
      const fallbackRes = await client.query(
        `SELECT * FROM saas_plans WHERE is_active = TRUE ORDER BY monthly_price ASC LIMIT 1`
      );
      targetPlan = fallbackRes.rows[0];
    }

    const baseSlug = generateCleanSlug(gym_name);
    let finalSlug = baseSlug;
    const slugSuffix = crypto.randomBytes(3).toString('hex');

    const slugExists = await client.query('SELECT 1 FROM organizations WHERE slug = $1', [finalSlug]);
    if (slugExists.rows.length > 0) {
      finalSlug = `${baseSlug}-${slugSuffix}`;
    }

    const orgHashId = `org_${crypto.randomBytes(12).toString('hex')}`;
    const initialOrgStatus = 'pending_approval';

    const orgQuery = `
      INSERT INTO organizations (hash_id, name, slug, legal_name, tax_id_gst, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, hash_id, name, slug, status;
    `;
    const orgResult = await client.query(orgQuery, [
      orgHashId,
      gym_name.trim(),
      finalSlug,
      legal_name ? legal_name.trim() : null,
      tax_id_gst ? tax_id_gst.trim().toUpperCase() : null,
      initialOrgStatus
    ]);
    const organization = orgResult.rows[0];

    const passwordHash = await bcrypt.hash(password, 12);
    const userHashId = `usr_${crypto.randomBytes(12).toString('hex')}`;

    const userQuery = `
      INSERT INTO users (
        hash_id, organization_id, name, phone, email, password_hash, status, is_super_admin
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', FALSE)
      RETURNING id, hash_id, name, phone, email;
    `;
    const userResult = await client.query(userQuery, [
      userHashId,
      organization.id,
      owner_name.trim(),
      cleanPhone,
      cleanEmail,
      passwordHash
    ]);
    const user = userResult.rows[0];

    await client.query(
      `UPDATE organizations SET owner_user_id = $1 WHERE id = $2`,
      [user.id, organization.id]
    );

    const defaultRoles = [
      { name: 'Owner', slug: 'owner', description: 'Full access to organization settings, finance, and all branches.' },
      { name: 'Manager', slug: 'manager', description: 'Branch management, staff, inventory and members.' },
      { name: 'Receptionist', slug: 'receptionist', description: 'Front desk billing, check-in, and member inquiries.' },
      { name: 'Trainer', slug: 'trainer', description: 'Assigned member workouts, diet, and attendance.' }
    ];

    let ownerRoleId = null;
    for (const r of defaultRoles) {
      const roleHashId = `rol_${crypto.randomBytes(12).toString('hex')}`;
      const roleRes = await client.query(
        `INSERT INTO roles (hash_id, organization_id, name, slug, description, is_system_role)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id, slug;`,
        [roleHashId, organization.id, r.name, r.slug, r.description]
      );
      if (r.slug === 'owner') {
        ownerRoleId = roleRes.rows[0].id;
      }
    }

    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`,
      [user.id, ownerRoleId]
    );

    const branchHashId = `brn_${crypto.randomBytes(12).toString('hex')}`;
    const branchQuery = `
      INSERT INTO branches (
        hash_id, organization_id, name, code, phone, email,
        address_line1, city, state, pincode, is_active
      ) VALUES ($1, $2, $3, 'MAIN-01', $4, $5, $6, $7, $8, $9, TRUE)
      RETURNING id, hash_id, name, code;
    `;
    const branchResult = await client.query(branchQuery, [
      branchHashId,
      organization.id,
      branch_name ? branch_name.trim() : `${gym_name.trim()} Head Branch`,
      cleanPhone,
      cleanEmail,
      address ? address.trim() : null,
      city ? city.trim() : null,
      state ? state.trim() : null,
      pincode ? pincode.trim() : null
    ]);
    const branch = branchResult.rows[0];

    await client.query(
      `INSERT INTO user_branches (user_id, branch_id) VALUES ($1, $2)`,
      [user.id, branch.id]
    );

    await client.query(
      `INSERT INTO organization_settings (organization_id, currency, timezone, invoice_prefix, member_code_prefix)
       VALUES ($1, 'INR', 'Asia/Kolkata', 'INV', 'MEM')`,
      [organization.id]
    );

    let createdSub = null;
    let invNum = null;
    let totalAmount = 0;

    if (targetPlan) {
      const subHashId = `sub_${crypto.randomBytes(12).toString('hex')}`;
      const durationDays = billing_cycle === 'yearly' ? 365 : 30;
      const trialDays = 14;
      const subStatus = 'pending_approval';

      const subInsertQuery = `
        INSERT INTO saas_subscriptions (
          hash_id, organization_id, plan_id, status, start_date, end_date, trial_end_date, auto_renew
        ) VALUES (
          $1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + $5::int, CURRENT_DATE + $6::int, TRUE
        ) RETURNING id, hash_id;
      `;
      const subRes = await client.query(subInsertQuery, [
        subHashId,
        organization.id,
        targetPlan.id,
        subStatus,
        durationDays,
        trialDays
      ]);
      createdSub = subRes.rows[0];

      const invHashId = `sinv_${crypto.randomBytes(12).toString('hex')}`;
      invNum = `INV-SAAS-${Date.now().toString().slice(-6)}`;
      const baseAmount = billing_cycle === 'yearly'
        ? Number(targetPlan.yearly_price || targetPlan.monthly_price * 10)
        : Number(targetPlan.monthly_price);
      const taxAmount = +(baseAmount * 0.18).toFixed(2);
      totalAmount = +(baseAmount + taxAmount).toFixed(2);

      await client.query(
        `INSERT INTO saas_invoices (
          hash_id, organization_id, subscription_id, invoice_number,
          amount, tax_amount, total_amount, status, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid', CURRENT_DATE + 3);`,
        [
          invHashId,
          organization.id,
          createdSub.id,
          invNum,
          baseAmount,
          taxAmount,
          totalAmount
        ]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      pending_approval: true,
      message: 'Subscription request received. Application under Super Admin review.',
      gym: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        owner_name: user.name,
        phone: user.phone,
        email: user.email,
        plan_name: targetPlan?.name,
        invoice_number: invNum,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration transaction failed.',
      error: error.message
    });
  } finally {
    client.release();
  }
};

exports.login = async (req, res) => {
  const { phone, email, password } = req.body;
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  if ((!phone && !email) || !password) {
    return res.status(400).json({
      success: false,
      message: 'Mobile/Email aur Password required hain.'
    });
  }

  try {
    const cleanIdentifier = phone ? phone.trim() : email.trim().toLowerCase();

    const userQuery = `
      SELECT 
        u.id, u.hash_id, u.organization_id, u.name, u.phone, u.email,
        u.password_hash, u.status, u.is_super_admin,
        u.failed_login_attempts, u.locked_until, u.lockout_count,
        o.status AS org_status, o.name AS org_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE (u.phone = $1 OR u.email = $1) AND u.deleted_at IS NULL
    `;
    const result = await db.query(userQuery, [cleanIdentifier]);
    const user = result.rows[0];

    // Generic response if user does not exist (Prevents User Enumeration Attacks)
    if (!user) {
      await db.query(
        `INSERT INTO login_logs (hash_id, ip_address, user_agent, success, failure_reason)
         VALUES ($1, $2, $3, FALSE, 'USER_NOT_FOUND')`,
        [`log_${crypto.randomBytes(12).toString('hex')}`, ipAddress, userAgent]
      );
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // 1. Account Locked by Admin check
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is locked or deactivated by Admin.' });
    }

    // 2. Progressive Lockout Check
    const now = new Date();
    if (user.locked_until && new Date(user.locked_until) > now) {
      const remainingSeconds = Math.ceil((new Date(user.locked_until) - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);

      await db.query(
        `INSERT INTO login_logs (hash_id, user_id, organization_id, ip_address, user_agent, success, failure_reason)
         VALUES ($1, $2, $3, $4, $5, FALSE, 'ACCOUNT_TEMPORARILY_LOCKED')`,
        [`log_${crypto.randomBytes(12).toString('hex')}`, user.id, user.organization_id, ipAddress, userAgent]
      );

      return res.status(429).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        remaining_seconds: remainingSeconds,
        message: `Too many failed attempts. Security lock active. Kripya ${remainingMinutes} minute(s) baad prayas karein.`
      });
    }

    // 3. Organization State Verification
    if (user.org_status === 'pending_approval') {
      return res.status(403).json({
        success: false,
        code: 'PENDING_APPROVAL',
        message: 'Aapka gym verification under review hai. Super Admin activation ke baad hi portal open hoga.'
      });
    }

    if (user.org_status && ['suspended', 'cancelled'].includes(user.org_status)) {
      return res.status(403).json({ success: false, message: 'Gym subscription is currently suspended.' });
    }

    // 4. Password Verification
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      const currentAttempts = (user.failed_login_attempts || 0) + 1;
      const currentLockoutCount = user.lockout_count || 0;

      // Lockout thresholds:
      // Round 1: 4 failed attempts => Lock for 5 minutes
      // Round 2+: 1 further failed attempt => Lock for 15 minutes
      const maxAllowed = currentLockoutCount === 0 ? 4 : 1;

      if (currentAttempts >= maxAllowed) {
        const lockMinutes = currentLockoutCount === 0 ? 5 : 15;
        const newLockoutCount = currentLockoutCount + 1;

        await db.query(
          `UPDATE users 
           SET failed_login_attempts = 0,
               locked_until = NOW() + ($1 || ' minutes')::INTERVAL,
               lockout_count = $2
           WHERE id = $3`,
          [lockMinutes, newLockoutCount, user.id]
        );

        await db.query(
          `INSERT INTO login_logs (hash_id, user_id, organization_id, ip_address, user_agent, success, failure_reason)
           VALUES ($1, $2, $3, $4, $5, FALSE, $6)`,
          [
            `log_${crypto.randomBytes(12).toString('hex')}`,
            user.id,
            user.organization_id,
            ipAddress,
            userAgent,
            `LOCKOUT_TRIGGERED_${lockMinutes}M`
          ]
        );

        return res.status(429).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          remaining_seconds: lockMinutes * 60,
          message: `Galat password. Security reasons se aapka account ${lockMinutes} minutes ke liye temporary lock kar diya gaya hai.`
        });
      } else {
        // Increment failed attempts and return warning
        const attemptsLeft = maxAllowed - currentAttempts;

        await db.query(
          `UPDATE users 
           SET failed_login_attempts = $1 
           WHERE id = $2`,
          [currentAttempts, user.id]
        );

        await db.query(
          `INSERT INTO login_logs (hash_id, user_id, organization_id, ip_address, user_agent, success, failure_reason)
           VALUES ($1, $2, $3, $4, $5, FALSE, 'WRONG_PASSWORD')`,
          [`log_${crypto.randomBytes(12).toString('hex')}`, user.id, user.organization_id, ipAddress, userAgent]
        );

        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          attempts_left: attemptsLeft,
          message: `Invalid credentials. ${attemptsLeft} attempt(s) bache hain uske baad account lock ho jayega.`
        });
      }
    }

    // 5. Success Path: Reset all lockout & attempt counters immediately
    await db.query(
      `UPDATE users 
       SET failed_login_attempts = 0,
           locked_until = NULL,
           lockout_count = 0,
           last_login_at = NOW() 
       WHERE id = $1`,
      [user.id]
    );

    await db.query(
      `INSERT INTO login_logs (hash_id, user_id, organization_id, ip_address, user_agent, success)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [`log_${crypto.randomBytes(12).toString('hex')}`, user.id, user.organization_id, ipAddress, userAgent]
    );

    // Fetch Roles
    const rolesQuery = `
      SELECT r.id, r.name, r.slug
      FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND (r.organization_id = $2 OR r.organization_id IS NULL)
    `;
    const rolesRes = await db.query(rolesQuery, [user.id, user.organization_id]);

    if (rolesRes.rows.length === 0 && !user.is_super_admin) {
      return res.status(403).json({ success: false, message: 'No role assigned to this account.' });
    }

    const userRoles = rolesRes.rows.map(r => r.slug);
    const primaryRole = rolesRes.rows[0] || { slug: 'member', name: 'Member' };

    // Fetch Accessible Branches
    const branchQuery = `
      SELECT b.id, b.hash_id, b.name, b.code 
      FROM branches b
      JOIN user_branches ub ON ub.branch_id = b.id
      WHERE ub.user_id = $1 AND b.deleted_at IS NULL AND b.is_active = TRUE
      ORDER BY b.id ASC
    `;
    const branchesRes = await db.query(branchQuery, [user.id]);
    const defaultBranch = branchesRes.rows[0] || null;

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is missing from server environment.');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        userHashId: user.hash_id,
        orgId: user.organization_id,
        roles: userRoles,
        role: primaryRole.slug,
        isSuperAdmin: user.is_super_admin
      },
      secret,
      { expiresIn: '12h', algorithm: 'HS256' }
    );

    return res.json({
      success: true,
      token,
      user: {
        hash_id: user.hash_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        organization_name: user.org_name,
        role: primaryRole.slug,
        role_name: primaryRole.name,
        roles: userRoles,
        active_branch: defaultBranch ? {
          id: defaultBranch.id,
          hash_id: defaultBranch.hash_id,
          name: defaultBranch.name,
          code: defaultBranch.code
        } : null,
        accessible_branches: branchesRes.rows.map(b => ({
          id: b.id,
          hash_id: b.hash_id,
          name: b.name,
          code: b.code
        }))
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Authentication failed due to server error.' });
  }
};