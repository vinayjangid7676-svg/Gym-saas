const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');

// GET /api/v1/profile/me
exports.getMyProfile = async (req, res) => {
  const userId = req.user.userId || req.user.id;
  const orgId = req.user.orgId || req.user.organization_id;
  const primaryRole = req.user.role || (req.user.roles && req.user.roles[0]) || 'owner';

  try {
    // 1. Base User Query
    const userRes = await db.query(
      `SELECT id, hash_id, organization_id, name, phone, email, status, is_super_admin, last_login_at, created_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile nahi mili.' });
    }

    const userData = userRes.rows[0];

    // 2. Fetch User Roles
    const rolesRes = await db.query(
      `SELECT r.id, r.name, r.slug, r.description
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );
    const roles = rolesRes.rows;
    const isOwner = roles.some((r) => r.slug === 'owner') || userData.is_super_admin;
    const isTrainer = roles.some((r) => ['trainer', 'manager', 'receptionist', 'staff'].includes(r.slug));

    let ownerData = null;
    let trainerData = null;

    // 3. GYM OWNER PROFILE DETAILS
    if (isOwner) {
      const orgRes = await db.query(
        `SELECT 
          o.id, o.hash_id, o.name AS gym_name, o.slug, o.legal_name, o.tax_id_gst, o.status AS org_status,
          o.settings, o.created_at AS gym_registered_at,
          os.currency, os.timezone, os.invoice_prefix, os.member_code_prefix, os.tax_enabled,
          sub.status AS subscription_status, sub.start_date AS sub_start, sub.end_date AS sub_end, sub.trial_end_date,
          sp.name AS plan_name, sp.monthly_price, sp.yearly_price, sp.max_branches, sp.max_members
         FROM organizations o
         LEFT JOIN organization_settings os ON os.organization_id = o.id
         LEFT JOIN saas_subscriptions sub ON sub.organization_id = o.id AND sub.status IN ('trial', 'active', 'pending_approval')
         LEFT JOIN saas_plans sp ON sp.id = sub.plan_id
         WHERE o.id = $1
         ORDER BY sub.id DESC LIMIT 1`,
        [orgId]
      );

      // Primary Branch details
      const branchRes = await db.query(
        `SELECT b.id, b.hash_id, b.name, b.code, b.phone, b.email,
                b.address_line1, b.address_line2, b.city, b.state, b.country, b.pincode,
                b.opening_time, b.closing_time, b.is_active
         FROM branches b
         WHERE b.organization_id = $1 AND b.deleted_at IS NULL
         ORDER BY b.id ASC`,
        [orgId]
      );

      // Total Counts for quick stats
      const countsRes = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM members WHERE organization_id = $1 AND deleted_at IS NULL) AS total_members,
          (SELECT COUNT(*) FROM branches WHERE organization_id = $1 AND deleted_at IS NULL) AS total_branches,
          (SELECT COUNT(*) FROM staff_profiles WHERE organization_id = $1 AND is_active = TRUE) AS active_staff
        `,
        [orgId]
      );

      ownerData = {
        organization: orgRes.rows[0] || null,
        branches: branchRes.rows,
        primary_branch: branchRes.rows[0] || null,
        stats: countsRes.rows[0] || {}
      };
    }

    // 4. TRAINER / STAFF PROFILE DETAILS
    if (isTrainer) {
      const staffRes = await db.query(
        `SELECT 
          sp.id, sp.hash_id, sp.employee_code, sp.designation, sp.joining_date,
          sp.payout_type, sp.monthly_fixed_salary, sp.hourly_rate, sp.commission_percentage,
          sp.shift_start_time, sp.shift_end_time, sp.weekly_off,
          sp.late_grace_minutes, sp.is_active,
          b.name AS branch_name, b.code AS branch_code
         FROM staff_profiles sp
         LEFT JOIN branches b ON sp.branch_id = b.id
         WHERE sp.user_id = $1 AND sp.organization_id = $2`,
        [userId, orgId]
      );

      if (staffRes.rows.length > 0) {
        const staff = staffRes.rows[0];

        // Trainer Specializations
        const specRes = await db.query(
          `SELECT ts.id, ts.name 
           FROM trainer_specializations ts
           JOIN trainer_specialization_assignments tsa ON tsa.specialization_id = ts.id
           WHERE tsa.trainer_id = $1`,
          [staff.id]
        );

        // Assigned Active PT / Gym Members
        const assignedMembersRes = await db.query(
          `SELECT m.id, m.hash_id, m.first_name, m.last_name, m.phone, m.member_code, tm.assigned_from, tm.status
           FROM trainer_members tm
           JOIN members m ON m.id = tm.member_id
           WHERE tm.trainer_id = $1 AND tm.status = 'active'
           ORDER BY tm.assigned_from DESC LIMIT 10`,
          [staff.id]
        );

        // PT Enrollments stats
        const ptStatsRes = await db.query(
          `SELECT 
            COUNT(id) AS active_pt_clients,
            COALESCE(SUM(sessions_total), 0) AS total_pt_sessions,
            COALESCE(SUM(sessions_used), 0) AS used_pt_sessions
           FROM personal_training_enrollments
           WHERE trainer_id = $1 AND status = 'active'`,
          [staff.id]
        );

        trainerData = {
          staff_info: staff,
          specializations: specRes.rows.map((s) => s.name),
          assigned_members: assignedMembersRes.rows,
          pt_stats: ptStatsRes.rows[0] || {}
        };
      }
    }

    return res.status(200).json({
      success: true,
      profile_type: isOwner ? 'owner' : (isTrainer ? 'trainer' : 'standard'),
      user: userData,
      roles,
      owner_data: ownerData,
      trainer_data: trainerData
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Profile data load nahi ho saka: ' + error.message });
  }
};

// PUT /api/v1/profile/update-owner
exports.updateOwnerProfile = async (req, res) => {
  const client = await db.connect();
  const userId = req.user.userId || req.user.id;
  const orgId = req.user.orgId || req.user.organization_id;

  const {
    owner_name,
    phone,
    email,
    gym_name,
    legal_name,
    tax_id_gst,
    primary_branch_id,
    branch_name,
    address_line1,
    city,
    state,
    pincode,
    opening_time,
    closing_time
  } = req.body;

  try {
    await client.query('BEGIN');

    // 1. Update User Record
    if (owner_name || phone || email) {
      const userCheck = await client.query(
        `SELECT id FROM users WHERE (phone = $1 OR (email IS NOT NULL AND email = $2)) AND id != $3`,
        [phone ? phone.trim() : '', email ? email.trim().toLowerCase() : '', userId]
      );
      if (userCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Yeh phone ya email already doosre account me mapped hai.' });
      }

      await client.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             updated_at = NOW()
         WHERE id = $4`,
        [owner_name ? owner_name.trim() : null, phone ? phone.trim() : null, email ? email.trim().toLowerCase() : null, userId]
      );
    }

    // 2. Update Organization
    await client.query(
      `UPDATE organizations
       SET name = COALESCE($1, name),
           legal_name = COALESCE($2, legal_name),
           tax_id_gst = COALESCE($3, tax_id_gst),
           updated_at = NOW()
       WHERE id = $4`,
      [gym_name ? gym_name.trim() : null, legal_name ? legal_name.trim() : null, tax_id_gst ? tax_id_gst.trim().toUpperCase() : null, orgId]
    );

    // 3. Update Primary Branch
    if (primary_branch_id) {
      await client.query(
        `UPDATE branches
         SET name = COALESCE($1, name),
             address_line1 = COALESCE($2, address_line1),
             city = COALESCE($3, city),
             state = COALESCE($4, state),
             pincode = COALESCE($5, pincode),
             opening_time = COALESCE($6, opening_time),
             closing_time = COALESCE($7, closing_time),
             updated_at = NOW()
         WHERE id = $8 AND organization_id = $9`,
        [
          branch_name ? branch_name.trim() : null,
          address_line1 ? address_line1.trim() : null,
          city ? city.trim() : null,
          state ? state.trim() : null,
          pincode ? pincode.trim() : null,
          opening_time || null,
          closing_time || null,
          primary_branch_id,
          orgId
        ]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Gym Owner aur Gym details safaltapoorvak update ho gayi.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update Owner Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Update failed: ' + error.message });
  } finally {
    client.release();
  }
};

// PUT /api/v1/profile/update-trainer
exports.updateTrainerProfile = async (req, res) => {
  const client = await db.connect();
  const userId = req.user.userId || req.user.id;
  const orgId = req.user.orgId || req.user.organization_id;

  const {
    name,
    phone,
    email,
    designation,
    specializations
  } = req.body;

  try {
    await client.query('BEGIN');

    // 1. Update User basic info
    if (name || phone || email) {
      const userCheck = await client.query(
        `SELECT id FROM users WHERE (phone = $1 OR (email IS NOT NULL AND email = $2)) AND id != $3`,
        [phone ? phone.trim() : '', email ? email.trim().toLowerCase() : '', userId]
      );
      if (userCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Yeh phone ya email already in use hai.' });
      }

      await client.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             updated_at = NOW()
         WHERE id = $4`,
        [name ? name.trim() : null, phone ? phone.trim() : null, email ? email.trim().toLowerCase() : null, userId]
      );
    }

    // 2. Fetch Staff Profile ID
    const staffRes = await client.query(
      `SELECT id FROM staff_profiles WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId]
    );

    if (staffRes.rows.length > 0) {
      const staffId = staffRes.rows[0].id;

      if (designation) {
        await client.query(
          `UPDATE staff_profiles
           SET designation = $1, updated_at = NOW()
           WHERE id = $2`,
          [designation.trim(), staffId]
        );
      }

      // 3. Handle Specializations (comma separated or array)
      if (Array.isArray(specializations)) {
        await client.query(
          `DELETE FROM trainer_specialization_assignments WHERE trainer_id = $1`,
          [staffId]
        );

        for (const specName of specializations) {
          const cleanName = String(specName).trim();
          if (!cleanName) continue;

          // Upsert specialization
          let specObj = await client.query(
            `SELECT id FROM trainer_specializations WHERE organization_id = $1 AND lower(name) = lower($2)`,
            [orgId, cleanName]
          );

          let specId = null;
          if (specObj.rows.length === 0) {
            const hashId = `spc_${crypto.randomBytes(12).toString('hex')}`;
            const newSpec = await client.query(
              `INSERT INTO trainer_specializations (hash_id, organization_id, name)
               VALUES ($1, $2, $3) RETURNING id`,
              [hashId, orgId, cleanName]
            );
            specId = newSpec.rows[0].id;
          } else {
            specId = specObj.rows[0].id;
          }

          await client.query(
            `INSERT INTO trainer_specialization_assignments (trainer_id, specialization_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [staffId, specId]
          );
        }
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Trainer profile update ho gayi.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update Trainer Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Update failed: ' + error.message });
  } finally {
    client.release();
  }
};

// POST /api/v1/profile/change-password
exports.changePassword = async (req, res) => {
  const userId = req.user.userId || req.user.id;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Purana password aur naya password (min 6 characters) zaroori hain.'
    });
  }

  try {
    const userRes = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User nahi mila.' });
    }

    const isMatch = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password galat hai.' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );

    return res.status(200).json({ success: true, message: 'Password safaltapoorvak badal diya gaya hai.' });
  } catch (error) {
    console.error('Change Password Error:', error);
    return res.status(500).json({ success: false, message: 'Password change error: ' + error.message });
  }
};