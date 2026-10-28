const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. GET ALL STAFF (Multi-Branch, Roles, Skills, Attendance & PT stats)
// ================================================================
exports.getStaff = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { branch_id, is_active, search } = req.query;

  try {
    let query = `
      SELECT 
        sp.id, 
        sp.hash_id, 
        sp.employee_code, 
        sp.designation,
        sp.payout_type, 
        sp.monthly_fixed_salary, 
        sp.hourly_rate,
        sp.commission_percentage,
        sp.shift_start_time, 
        sp.shift_end_time, 
        sp.weekly_off,
        sp.late_grace_minutes,
        sp.overtime_multiplier,
        sp.is_active,
        sp.created_at,
        u.hash_id as user_hash_id,
        u.name, 
        u.phone, 
        u.email,
        r.id as role_id, 
        r.name as role_name, 
        r.slug as role_slug,
        b.id as branch_id, 
        b.name as branch_name, 
        b.code as branch_code,
        COALESCE((
          SELECT json_agg(json_build_object('id', ts.id, 'name', ts.name))
          FROM trainer_specialization_assignments tsa
          JOIN trainer_specializations ts ON ts.id = tsa.specialization_id
          WHERE tsa.trainer_id = sp.id
        ), '[]'::json) as skills,
        (
          SELECT COUNT(*)::int 
          FROM personal_training_enrollments pte 
          WHERE pte.trainer_id = sp.id AND pte.status = 'active'
        ) as active_pt_count,
        (
          SELECT json_build_object(
            'status', sa.status,
            'clock_in', sa.clock_in,
            'clock_out', sa.clock_out,
            'worked_minutes', sa.worked_minutes
          )
          FROM staff_attendance sa
          WHERE sa.staff_id = sp.id AND sa.attendance_date = CURRENT_DATE
          LIMIT 1
        ) as today_attendance
      FROM staff_profiles sp
      JOIN users u ON u.id = sp.user_id
      JOIN branches b ON b.id = sp.branch_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE sp.organization_id = $1
    `;

    const params = [parseInt(orgId, 10)];

    if (branch_id && !isNaN(parseInt(branch_id, 10))) {
      params.push(parseInt(branch_id, 10));
      query += ` AND sp.branch_id = $${params.length}`;
    }

    if (is_active !== undefined && is_active !== '') {
      params.push(is_active === 'true');
      query += ` AND sp.is_active = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (
        LOWER(u.name) LIKE $${params.length} OR 
        LOWER(u.phone) LIKE $${params.length} OR 
        LOWER(sp.employee_code) LIKE $${params.length} OR
        LOWER(sp.designation) LIKE $${params.length}
      )`;
    }

    query += ` ORDER BY sp.id DESC;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('getStaff Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. CREATE STAFF MEMBER (Atomic User, Role, Branch & Profile)
// ================================================================
exports.createStaff = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const currentUserId = req.user?.userId || req.user?.id;

  const {
    branch_id,
    name,
    phone,
    email,
    password = 'Staff@123',
    role_slug = 'trainer',
    employee_code,
    designation = 'Fitness Trainer',
    joining_date = new Date().toISOString().split('T')[0],
    payout_type = 'fixed',
    monthly_fixed_salary = 0.00,
    hourly_rate = 0.00,
    commission_percentage = 0.00,
    shift_start_time = '06:00:00',
    shift_end_time = '14:00:00',
    weekly_off = 0,
    late_grace_minutes = 20,
    overtime_multiplier = 1.5,
    specializations = []
  } = req.body;

  const targetBranchId = branch_id ? parseInt(branch_id, 10) : req.user?.branch_id;

  if (!targetBranchId || !name || !phone) {
    client.release();
    return res.status(400).json({
      success: false,
      message: 'Branch ID, Name, aur Mobile Number anivarya hain.'
    });
  }

  const cleanPhone = phone.trim();
  const cleanEmail = email ? email.trim().toLowerCase() : null;

  try {
    await client.query('BEGIN');

    // Branch verification
    const branchCheck = await client.query(
      'SELECT id, name FROM branches WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [targetBranchId, orgId]
    );

    if (branchCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Invalid Branch context specified.' });
    }

    // Duplicate Phone Check
    const existingUser = await client.query(
      'SELECT id FROM users WHERE phone = $1 AND organization_id = $2',
      [cleanPhone, orgId]
    );

    let userId;
    let userHashId;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      const profileCheck = await client.query(
        'SELECT id FROM staff_profiles WHERE user_id = $1 AND organization_id = $2',
        [userId, orgId]
      );
      if (profileCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          success: false, 
          message: 'Is phone number ke saath staff member already registered hai.' 
        });
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const pwdHash = await bcrypt.hash(password, salt);
      userHashId = generateHashId('usr_');

      const userRes = await client.query(
        `INSERT INTO users (
          hash_id, organization_id, name, phone, email,
          password_hash, status, is_super_admin, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active', FALSE, NOW(), NOW())
        RETURNING id;`,
        [userHashId, orgId, name.trim(), cleanPhone, cleanEmail, pwdHash]
      );
      userId = userRes.rows[0].id;
    }

    // Auto or Custom Employee Code
    let finalEmpCode = employee_code ? employee_code.trim().toUpperCase() : null;
    if (!finalEmpCode) {
      const countRes = await client.query(
        'SELECT COUNT(*) as total FROM staff_profiles WHERE organization_id = $1',
        [orgId]
      );
      const nextSeq = parseInt(countRes.rows[0].total, 10) + 1;
      finalEmpCode = `STF-${nextSeq.toString().padStart(4, '0')}`;
    } else {
      const codeCheck = await client.query(
        'SELECT id FROM staff_profiles WHERE employee_code = $1 AND organization_id = $2',
        [finalEmpCode, orgId]
      );
      if (codeCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          success: false, 
          message: `Employee Code "${finalEmpCode}" already registered hai.` 
        });
      }
    }

    // Role Mapping
    let roleRes = await client.query(
      'SELECT id FROM roles WHERE (organization_id = $1 OR organization_id IS NULL) AND slug = $2 LIMIT 1',
      [orgId, role_slug.toLowerCase()]
    );

    let roleId;
    if (roleRes.rows.length > 0) {
      roleId = roleRes.rows[0].id;
    } else {
      const newRoleHash = generateHashId('rol_');
      const createRole = await client.query(
        `INSERT INTO roles (hash_id, organization_id, name, slug, description, is_system_role)
         VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
        [newRoleHash, orgId, designation, role_slug.toLowerCase(), `${designation} default role`]
      );
      roleId = createRole.rows[0].id;
    }

    await client.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleId]
    );

    await client.query(
      'INSERT INTO user_branches (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, targetBranchId]
    );

    // Profile Insertion
    const staffHashId = generateHashId('stf_');
    const staffInsertQuery = `
      INSERT INTO staff_profiles (
        hash_id, organization_id, branch_id, user_id,
        employee_code, designation, joining_date, payout_type,
        monthly_fixed_salary, hourly_rate, commission_percentage,
        shift_start_time, shift_end_time, weekly_off,
        late_grace_minutes, overtime_multiplier, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, TRUE, NOW(), NOW())
      RETURNING *;
    `;

    const staffRes = await client.query(staffInsertQuery, [
      staffHashId,
      orgId,
      targetBranchId,
      userId,
      finalEmpCode,
      designation.trim(),
      joining_date,
      payout_type,
      parseFloat(monthly_fixed_salary || 0),
      parseFloat(hourly_rate || 0),
      parseFloat(commission_percentage || 0),
      shift_start_time,
      shift_end_time,
      parseInt(weekly_off, 10),
      parseInt(late_grace_minutes, 10),
      parseFloat(overtime_multiplier || 1.5)
    ]);

    const staffId = staffRes.rows[0].id;

    // Specializations
    if (Array.isArray(specializations) && specializations.length > 0) {
      for (const spec of specializations) {
        const specName = String(spec).trim();
        if (!specName) continue;

        let specDb = await client.query(
          'SELECT id FROM trainer_specializations WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
          [orgId, specName]
        );

        let specId;
        if (specDb.rows.length > 0) {
          specId = specDb.rows[0].id;
        } else {
          const specHash = generateHashId('spc_');
          const insSpec = await client.query(
            'INSERT INTO trainer_specializations (hash_id, organization_id, name) VALUES ($1, $2, $3) RETURNING id',
            [specHash, orgId, specName]
          );
          specId = insSpec.rows[0].id;
        }

        await client.query(
          'INSERT INTO trainer_specialization_assignments (trainer_id, specialization_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [staffId, specId]
        );
      }
    }

    // Audit Log
    const auditHash = generateHashId('adt_');
    await client.query(
      `INSERT INTO audit_logs (
        hash_id, organization_id, user_id, branch_id,
        action, entity_type, entity_id, new_data, created_at
      ) VALUES ($1, $2, $3, $4, 'CREATE_STAFF', 'staff_profiles', $5, $6, NOW())`,
      [
        auditHash,
        orgId,
        currentUserId || userId,
        targetBranchId,
        staffId,
        JSON.stringify({ name, phone: cleanPhone, employee_code: finalEmpCode, designation })
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Staff member "${name}" (${finalEmpCode}) successfully registered ho gaya.`,
      data: staffRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createStaff Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 3. UPDATE STAFF PROFILE
// ================================================================
exports.updateStaff = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const { id } = req.params;
  const {
    name,
    phone,
    email,
    designation,
    payout_type,
    monthly_fixed_salary,
    hourly_rate,
    commission_percentage,
    shift_start_time,
    shift_end_time,
    weekly_off,
    is_active,
    specializations
  } = req.body;

  try {
    await client.query('BEGIN');

    const staffRes = await client.query(
      `SELECT id, user_id, branch_id FROM staff_profiles 
       WHERE (id = $1 OR hash_id = $2) AND organization_id = $3 FOR UPDATE`,
      [isNaN(parseInt(id, 10)) ? -1 : parseInt(id, 10), id, orgId]
    );

    if (staffRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Staff profile record nahi mila.' });
    }

    const staffRecord = staffRes.rows[0];

    // User updates
    if (name || phone || email) {
      await client.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             updated_at = NOW()
         WHERE id = $4 AND organization_id = $5`,
        [name ? name.trim() : null, phone ? phone.trim() : null, email ? email.trim() : null, staffRecord.user_id, orgId]
      );
    }

    // Profile updates
    const updateStaffQuery = `
      UPDATE staff_profiles
      SET designation = COALESCE($1, designation),
          payout_type = COALESCE($2, payout_type),
          monthly_fixed_salary = COALESCE($3, monthly_fixed_salary),
          hourly_rate = COALESCE($4, hourly_rate),
          commission_percentage = COALESCE($5, commission_percentage),
          shift_start_time = COALESCE($6, shift_start_time),
          shift_end_time = COALESCE($7, shift_end_time),
          weekly_off = COALESCE($8, weekly_off),
          is_active = COALESCE($9, is_active),
          updated_at = NOW()
      WHERE id = $10 AND organization_id = $11
      RETURNING *;
    `;

    const updatedProfile = await client.query(updateStaffQuery, [
      designation || null,
      payout_type || null,
      monthly_fixed_salary !== undefined ? parseFloat(monthly_fixed_salary) : null,
      hourly_rate !== undefined ? parseFloat(hourly_rate) : null,
      commission_percentage !== undefined ? parseFloat(commission_percentage) : null,
      shift_start_time || null,
      shift_end_time || null,
      weekly_off !== undefined ? parseInt(weekly_off, 10) : null,
      is_active !== undefined ? Boolean(is_active) : null,
      staffRecord.id,
      orgId
    ]);

    // Specializations update
    if (Array.isArray(specializations)) {
      await client.query('DELETE FROM trainer_specialization_assignments WHERE trainer_id = $1', [staffRecord.id]);
      for (const spec of specializations) {
        const specName = String(spec).trim();
        if (!specName) continue;

        let specDb = await client.query(
          'SELECT id FROM trainer_specializations WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
          [orgId, specName]
        );

        let specId;
        if (specDb.rows.length > 0) {
          specId = specDb.rows[0].id;
        } else {
          const specHash = generateHashId('spc_');
          const insSpec = await client.query(
            'INSERT INTO trainer_specializations (hash_id, organization_id, name) VALUES ($1, $2, $3) RETURNING id',
            [specHash, orgId, specName]
          );
          specId = insSpec.rows[0].id;
        }

        await client.query(
          'INSERT INTO trainer_specialization_assignments (trainer_id, specialization_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [staffRecord.id, specId]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Staff profile safely updated.',
      data: updatedProfile.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateStaff Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. REAL-TIME CLOCK IN / OUT WITH 1-TIME DAILY RESTRICTION
// ================================================================
exports.staffClockInOut = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { staff_id, action } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    const staffRes = await db.query(
      `SELECT id, branch_id, shift_start_time, shift_end_time, late_grace_minutes 
       FROM staff_profiles WHERE (id = $1 OR hash_id = $2) AND organization_id = $3`,
      [isNaN(parseInt(staff_id, 10)) ? -1 : parseInt(staff_id, 10), staff_id, orgId]
    );

    if (staffRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Valid staff member record nahi mila.' });
    }

    const staff = staffRes.rows[0];

    // Check existing attendance for today
    const attendanceCheck = await db.query(
      'SELECT id, clock_in, clock_out FROM staff_attendance WHERE staff_id = $1 AND attendance_date = $2',
      [staff.id, today]
    );

    const existingAtt = attendanceCheck.rows[0];

    // Strict Enforcement: If both clock_in and clock_out are done, reject any further action
    if (existingAtt && existingAtt.clock_in && existingAtt.clock_out) {
      return res.status(400).json({
        success: false,
        message: 'Aaj ki shift complete ho chuki hai (Punch-in aur Punch-out dono ho chuke hain). Aaj dobara attendance nahi lag sakti.'
      });
    }

    if (action === 'clock_in') {
      if (existingAtt && existingAtt.clock_in) {
        return res.status(400).json({
          success: false,
          message: 'Aap aaj pehle se clock-in kar chuke hain.'
        });
      }

      const hashId = generateHashId('sta_');
      const query = `
        INSERT INTO staff_attendance (
          hash_id, organization_id, branch_id, staff_id,
          attendance_date, clock_in, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), 'present', NOW())
        ON CONFLICT (staff_id, attendance_date) 
        DO UPDATE SET clock_in = NOW(), status = 'present'
        RETURNING *;
      `;
      const { rows } = await db.query(query, [hashId, orgId, staff.branch_id, staff.id, today]);
      return res.json({ success: true, message: 'Clock-in successfully recorded.', data: rows[0] });

    } else if (action === 'clock_out') {
      if (!existingAtt || !existingAtt.clock_in) {
        return res.status(400).json({
          success: false,
          message: 'Pehle clock-in karna anivarya hai.'
        });
      }

      const query = `
        UPDATE staff_attendance 
        SET clock_out = NOW(),
            worked_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - clock_in)) / 60))
        WHERE staff_id = $1 AND attendance_date = $2
        RETURNING *;
      `;
      const { rows } = await db.query(query, [staff.id, today]);
      return res.json({ success: true, message: 'Clock-out successfully recorded. Shift complete!', data: rows[0] });

    } else {
      return res.status(400).json({ success: false, message: 'Invalid attendance action specified.' });
    }
  } catch (error) {
    console.error('staffClockInOut Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};