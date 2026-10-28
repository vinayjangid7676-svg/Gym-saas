const crypto = require('crypto');
const db = require('../config/db');

// Cryptographically random 32-character public hash identifier
const generateHashId = (prefix = 'brn_') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. GET ALL BRANCHES (Context-Aware for Logged-In User)
// ================================================================
exports.getBranches = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;
  const userId = req.user?.userId || req.user?.id;
  const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);

  if (!orgId && !isSuperAdmin) {
    return res.status(400).json({ success: false, message: 'Organization context missing.' });
  }

  try {
    // Determine user role inside this organization
    const roleRows = await db.query(
      `SELECT r.slug FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1 AND (r.organization_id = $2 OR r.organization_id IS NULL)`,
      [userId, orgId]
    );
    const roles = roleRows.rows.map((r) => r.slug.toLowerCase());
    const isOwnerOrManager = isSuperAdmin || roles.includes('owner') || roles.includes('manager');

    let query;
    let values;

    // Owners, Managers, and SuperAdmins can see all active branches of this organization
    if (isOwnerOrManager) {
      query = `
        SELECT 
          b.id, 
          b.hash_id, 
          b.organization_id, 
          b.name, 
          b.code, 
          b.phone, 
          b.email, 
          b.address_line1, 
          b.address_line2,
          b.city, 
          b.state, 
          b.country,
          b.pincode, 
          b.opening_time,
          b.closing_time,
          b.is_active, 
          b.created_at,
          (SELECT COUNT(m.id) FROM members m WHERE m.primary_branch_id = b.id AND m.status = 'active') AS active_members_count
        FROM branches b
        WHERE b.organization_id = $1 AND b.deleted_at IS NULL
        ORDER BY b.id ASC;
      `;
      values = [orgId];
    } else {
      // Front desk staff, trainers & receptionists can only see branches they are assigned to
      query = `
        SELECT 
          b.id, 
          b.hash_id, 
          b.organization_id, 
          b.name, 
          b.code, 
          b.phone, 
          b.email, 
          b.address_line1, 
          b.address_line2,
          b.city, 
          b.state, 
          b.country,
          b.pincode, 
          b.opening_time,
          b.closing_time,
          b.is_active, 
          b.created_at,
          (SELECT COUNT(m.id) FROM members m WHERE m.primary_branch_id = b.id AND m.status = 'active') AS active_members_count
        FROM branches b
        JOIN user_branches ub ON ub.branch_id = b.id
        WHERE b.organization_id = $1 AND ub.user_id = $2 AND b.deleted_at IS NULL AND b.is_active = TRUE
        ORDER BY b.id ASC;
      `;
      values = [orgId, userId];
    }

    const { rows } = await db.query(query, values);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch branches.', error: error.message });
  }
};

// ================================================================
// 2. GET SINGLE BRANCH BY ID / HASH_ID
// ================================================================
exports.getBranchById = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;
  const userId = req.user?.userId || req.user?.id;
  const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);
  const { id } = req.params;

  try {
    const isNumeric = /^\d+$/.test(id);
    const lookupField = isNumeric ? 'b.id' : 'b.hash_id';

    const branchQuery = `
      SELECT 
        b.*,
        (SELECT COUNT(m.id) FROM members m WHERE m.primary_branch_id = b.id AND m.deleted_at IS NULL) as total_registered_members,
        (SELECT COUNT(s.id) FROM staff_profiles s WHERE s.branch_id = b.id AND s.is_active = TRUE) as total_active_staff
      FROM branches b
      WHERE ${lookupField} = $1 AND b.organization_id = $2 AND b.deleted_at IS NULL;
    `;
    const { rows } = await db.query(branchQuery, [id, orgId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch nahi mili.' });
    }

    const branch = rows[0];

    // Check branch access permissions if user is not super admin or owner
    if (!isSuperAdmin) {
      const roleRows = await db.query(
        `SELECT r.slug FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND (r.organization_id = $2 OR r.organization_id IS NULL)`,
        [userId, orgId]
      );
      const roles = roleRows.rows.map((r) => r.slug.toLowerCase());
      const isOwner = roles.includes('owner');

      if (!isOwner) {
        const assignmentRes = await db.query(
          `SELECT 1 FROM user_branches WHERE user_id = $1 AND branch_id = $2`,
          [userId, branch.id]
        );
        if (assignmentRes.rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to view details of this branch.'
          });
        }
      }
    }

    return res.status(200).json({ success: true, data: branch });
  } catch (error) {
    console.error('Error fetching single branch:', error);
    return res.status(500).json({ success: false, message: 'Error retrieving branch.', error: error.message });
  }
};

// ================================================================
// 3. CREATE NEW BRANCH (SaaS Plan Limit Enforced)
// ================================================================
exports.createBranch = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;
  const userId = req.user?.userId || req.user?.id;
  const {
    name,
    code,
    phone,
    email,
    address_line1,
    address_line2,
    city,
    state,
    country = 'India',
    pincode,
    opening_time,
    closing_time
  } = req.body;

  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Branch Name aur Branch Code dono required hain.' });
  }

  const cleanName = String(name).trim();
  const cleanCode = String(code).trim().toUpperCase();

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Subscription Check: Max branches limit enforcement
    const subQuery = `
      SELECT p.max_branches
      FROM saas_subscriptions s
      JOIN saas_plans p ON p.id = s.plan_id
      WHERE s.organization_id = $1 AND s.status IN ('trial', 'active')
      ORDER BY s.id DESC LIMIT 1;
    `;
    const subRes = await client.query(subQuery, [orgId]);

    if (subRes.rows.length > 0 && subRes.rows[0].max_branches !== null) {
      const allowedBranches = subRes.rows[0].max_branches;
      const countRes = await client.query(
        `SELECT COUNT(id) FROM branches WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );
      const currentBranches = parseInt(countRes.rows[0].count, 10);

      if (currentBranches >= allowedBranches) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: `Branch limit reached! Aapke current SaaS plan me maximum ${allowedBranches} branches allowed hain. Upgrade to add more.`
        });
      }
    }

    // 2. Conflict Check: Code uniqueness check
    const codeCheck = await client.query(
      `SELECT id FROM branches WHERE organization_id = $1 AND UPPER(code) = $2 AND deleted_at IS NULL`,
      [orgId, cleanCode]
    );

    if (codeCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Branch Code '${cleanCode}' pehle se maujood hai. Unique code choose karein.`
      });
    }

    // 3. Insert Branch
    const hashId = generateHashId('brn_');
    const insertQuery = `
      INSERT INTO branches (
        hash_id, organization_id, name, code, phone, email,
        address_line1, address_line2, city, state, country, pincode,
        opening_time, closing_time, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      hashId,
      orgId,
      cleanName,
      cleanCode,
      phone ? String(phone).trim() : null,
      email ? String(email).trim().toLowerCase() : null,
      address_line1 ? String(address_line1).trim() : null,
      address_line2 ? String(address_line2).trim() : null,
      city ? String(city).trim() : null,
      state ? String(state).trim() : null,
      country,
      pincode ? String(pincode).trim() : null,
      opening_time || null,
      closing_time || null
    ];

    const branchResult = await client.query(insertQuery, values);
    const newBranch = branchResult.rows[0];

    // 4. Automatically give creating user access to this new branch
    await client.query(
      `INSERT INTO user_branches (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, newBranch.id]
    );

    // 5. Initialize default Branch Settings row
    await client.query(
      `INSERT INTO branch_settings (branch_id, settings, updated_at) 
       VALUES ($1, '{"allow_online_booking": true, "enforce_biometric": false}'::jsonb, NOW())
       ON CONFLICT (branch_id) DO NOTHING;`,
      [newBranch.id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Nayi branch successfully register ho gayi.',
      branch: newBranch
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating branch:', error);
    return res.status(500).json({ success: false, message: 'Branch create karne me error aayi.', error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. UPDATE BRANCH DETAILS
// ================================================================
exports.updateBranch = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;
  const { id } = req.params;
  const {
    name,
    code,
    phone,
    email,
    address_line1,
    address_line2,
    city,
    state,
    pincode,
    opening_time,
    closing_time,
    is_active
  } = req.body;

  try {
    const isNumeric = /^\d+$/.test(id);
    const lookupField = isNumeric ? 'id' : 'hash_id';

    // Verify branch exists
    const existingRes = await db.query(
      `SELECT * FROM branches WHERE ${lookupField} = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, orgId]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch nahi mili update karne ke liye.' });
    }

    const currentBranch = existingRes.rows[0];

    // If updating code, verify it does not conflict with another branch
    if (code && String(code).trim().toUpperCase() !== currentBranch.code) {
      const conflictCheck = await db.query(
        `SELECT id FROM branches 
         WHERE organization_id = $1 AND UPPER(code) = $2 AND id != $3 AND deleted_at IS NULL`,
        [orgId, String(code).trim().toUpperCase(), currentBranch.id]
      );
      if (conflictCheck.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'Ye Branch Code kisi doosri branch me use ho raha hai.' });
      }
    }

    // Safety Check: Preventing accidental deactivation if members are actively checking in
    if (is_active === false && currentBranch.is_active === true) {
      const todayAttendance = await db.query(
        `SELECT COUNT(id) FROM attendance WHERE branch_id = $1 AND check_in_time >= CURRENT_DATE`,
        [currentBranch.id]
      );
      if (parseInt(todayAttendance.rows[0].count, 10) > 0) {
        return res.status(400).json({
          success: false,
          message: 'Aaj ke din is branch me members check-in ho chuke hain. Aaj ke operational hours ke baad hi ise deactivate karein.'
        });
      }
    }

    const updateQuery = `
      UPDATE branches
      SET 
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        address_line1 = COALESCE($5, address_line1),
        address_line2 = COALESCE($6, address_line2),
        city = COALESCE($7, city),
        state = COALESCE($8, state),
        pincode = COALESCE($9, pincode),
        opening_time = COALESCE($10, opening_time),
        closing_time = COALESCE($11, closing_time),
        is_active = COALESCE($12, is_active),
        updated_at = NOW()
      WHERE id = $13 AND organization_id = $14
      RETURNING *;
    `;
    const values = [
      name !== undefined ? String(name).trim() : null,
      code !== undefined ? String(code).trim().toUpperCase() : null,
      phone !== undefined ? String(phone).trim() : null,
      email !== undefined ? String(email).trim().toLowerCase() : null,
      address_line1 !== undefined ? String(address_line1).trim() : null,
      address_line2 !== undefined ? String(address_line2).trim() : null,
      city !== undefined ? String(city).trim() : null,
      state !== undefined ? String(state).trim() : null,
      pincode !== undefined ? String(pincode).trim() : null,
      opening_time !== undefined ? opening_time : null,
      closing_time !== undefined ? closing_time : null,
      is_active !== undefined ? Boolean(is_active) : null,
      currentBranch.id,
      orgId
    ];

    const { rows } = await db.query(updateQuery, values);

    return res.status(200).json({
      success: true,
      message: 'Branch details successfully update ho gayi.',
      branch: rows[0]
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    return res.status(500).json({ success: false, message: 'Branch update failed.', error: error.message });
  }
};

// ================================================================
// 5. SOFT-DELETE BRANCH (Safe Deletion with Integrity Guard)
// ================================================================
exports.deleteBranch = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;
  const { id } = req.params;

  try {
    const isNumeric = /^\d+$/.test(id);
    const lookupField = isNumeric ? 'id' : 'hash_id';

    const branchRes = await db.query(
      `SELECT id, name FROM branches WHERE ${lookupField} = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, orgId]
    );

    if (branchRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch nahi mili.' });
    }

    const branch = branchRes.rows[0];

    // Check if active members exist
    const memberCheck = await db.query(
      `SELECT COUNT(id) FROM members WHERE primary_branch_id = $1 AND deleted_at IS NULL`,
      [branch.id]
    );

    if (parseInt(memberCheck.rows[0].count, 10) > 0) {
      return res.status(400).json({
        success: false,
        message: `Is branch me ${memberCheck.rows[0].count} members registered hain. Ise delete nahi kiya ja sakta. Pehle unhe doosri branch me transfer karein ya branch ko inactive mark karein.`
      });
    }

    // Soft delete
    await db.query(
      `UPDATE branches SET deleted_at = NOW(), is_active = FALSE WHERE id = $1 AND organization_id = $2`,
      [branch.id, orgId]
    );

    return res.status(200).json({
      success: true,
      message: `Branch '${branch.name}' safely remove kar di gayi.`
    });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return res.status(500).json({ success: false, message: 'Branch delete karne me error aayi.', error: error.message });
  }
};