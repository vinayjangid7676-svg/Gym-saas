const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. CREATE PT PACKAGE (e.g., 12 Sessions - ₹8000)
// ================================================================
exports.createPTPlan = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { name, session_count, price, validity_days = 30 } = req.body;

  if (!name || !session_count || price === undefined) {
    return res.status(400).json({ success: false, message: 'name, session_count, aur price zaroori hain.' });
  }

  try {
    const hashId = generateHashId('ptp_');
    const query = `
      INSERT INTO personal_training_plans (
        hash_id, organization_id, name, session_count, price, validity_days, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId,
      orgId,
      name.trim(),
      parseInt(session_count, 10),
      parseFloat(price),
      parseInt(validity_days, 10)
    ]);
    return res.status(201).json({ success: true, message: 'PT plan created successfully.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. ENROLL MEMBER INTO PT (With Strict Multi-Tenant Isolation)
// ================================================================
exports.enrollMemberPT = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { member_id, trainer_id, plan_id, start_date, invoice_id, notes } = req.body;

  if (!member_id || !trainer_id || !plan_id || !start_date) {
    return res.status(400).json({
      success: false,
      message: 'member_id, trainer_id, plan_id, aur start_date required hain.'
    });
  }

  try {
    const planRes = await db.query(
      'SELECT id, session_count, validity_days FROM personal_training_plans WHERE id = $1 AND organization_id = $2 AND is_active = TRUE',
      [parseInt(plan_id, 10), orgId]
    );
    if (planRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'PT plan active nahi hai ya exist nahi karta.' });
    }
    const ptPlan = planRes.rows[0];

    const startObj = new Date(start_date);
    const endObj = new Date(startObj);
    endObj.setDate(startObj.getDate() + Number(ptPlan.validity_days || 30));

    const hashId = generateHashId('pte_');
    const query = `
      INSERT INTO personal_training_enrollments (
        hash_id, member_id, trainer_id, plan_id, start_date, end_date,
        sessions_total, sessions_used, status, invoice_id, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'active', $8, $9, NOW())
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId,
      parseInt(member_id, 10),
      parseInt(trainer_id, 10),
      ptPlan.id,
      start_date,
      endObj.toISOString().split('T')[0],
      ptPlan.session_count,
      invoice_id ? parseInt(invoice_id, 10) : null,
      notes || null
    ]);

    return res.status(201).json({ success: true, message: 'Member enrolled into Personal Training.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. PUNCH / LOG DAILY WORKOUT SESSION (Atomic Meter Deduction)
// ================================================================
exports.logPTSession = async (req, res) => {
  const client = await db.connect();
  const {
    enrollment_id,
    scheduled_start,
    duration_minutes = 60,
    trainer_rating = 5,
    notes,
    status = 'completed'
  } = req.body;

  if (!enrollment_id || !scheduled_start) {
    client.release();
    return res.status(400).json({ success: false, message: 'enrollment_id aur scheduled_start zaroori hain.' });
  }

  try {
    await client.query('BEGIN');

    // Row-level lock to prevent concurrent double-punch
    const enrRes = await client.query(
      'SELECT id, sessions_total, sessions_used, status FROM personal_training_enrollments WHERE id = $1 FOR UPDATE',
      [parseInt(enrollment_id, 10)]
    );
    if (enrRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'PT enrollment nahi mila.' });
    }
    const enr = enrRes.rows[0];

    if (parseInt(enr.sessions_used, 10) >= parseInt(enr.sessions_total, 10)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Is enrollment ke sabhi sessions exhaust ho chuke hain.' });
    }

    const sessHashId = generateHashId('pts_');
    const sessQuery = `
      INSERT INTO personal_training_sessions (
        hash_id, enrollment_id, scheduled_start, scheduled_end,
        actual_start, actual_end, duration_minutes, trainer_rating, status, notes, created_at
      ) VALUES ($1, $2, $3, NULL, NOW(), NOW(), $4, $5, $6, $7, NOW())
      RETURNING *;
    `;
    const sessRes = await client.query(sessQuery, [
      sessHashId,
      enr.id,
      scheduled_start,
      parseInt(duration_minutes, 10),
      parseInt(trainer_rating, 10),
      status,
      notes || 'Routine completed successfully'
    ]);

    const updatedUsed = parseInt(enr.sessions_used, 10) + 1;
    const isFinished = updatedUsed >= parseInt(enr.sessions_total, 10) ? 'completed' : 'active';

    await client.query(
      'UPDATE personal_training_enrollments SET sessions_used = $1, status = $2 WHERE id = $3',
      [updatedUsed, isFinished, enr.id]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'PT session successfully punched!',
      data: {
        session: sessRes.rows[0],
        sessions_remaining: parseInt(enr.sessions_total, 10) - updatedUsed,
        updated_status: isFinished
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. GET PT PLANS
// ================================================================
exports.getPTPlans = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  try {
    const { rows } = await db.query(
      'SELECT * FROM personal_training_plans WHERE organization_id = $1 AND is_active = TRUE ORDER BY id DESC',
      [orgId]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 5. GET ENROLLMENTS (With Role Scoping & Expiry Alert)
// ================================================================
exports.getEnrollments = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const userId = req.user?.userId || req.user?.id;
  const userRole = (req.user?.role || '').toLowerCase();
  const { status, member_id, branch_id } = req.query;

  try {
    let query = `
      SELECT 
        pte.id, pte.hash_id, pte.start_date, pte.end_date,
        pte.sessions_total, pte.sessions_used,
        (pte.sessions_total - pte.sessions_used) AS sessions_remaining,
        pte.status, pte.created_at, pte.notes as enrollment_notes,
        m.id as member_id, m.first_name || ' ' || COALESCE(m.last_name, '') as member_name,
        m.member_code, m.phone as member_phone,
        COALESCE(u.name, 'Staff Trainer') as trainer_name,
        sp.employee_code as trainer_code,
        ptp.name as plan_name, ptp.price as plan_price,
        inv.invoice_number
      FROM personal_training_enrollments pte
      JOIN members m ON m.id = pte.member_id
      LEFT JOIN staff_profiles sp ON sp.id = pte.trainer_id
      LEFT JOIN users u ON u.id = sp.user_id
      JOIN personal_training_plans ptp ON ptp.id = pte.plan_id
      LEFT JOIN invoices inv ON inv.id = pte.invoice_id
      WHERE m.organization_id = $1
    `;
    const params = [parseInt(orgId, 10)];

    // Role Security: Trainer only gets their own assigned clients
    if (userRole === 'trainer') {
      const trainerProfRes = await db.query(
        'SELECT id FROM staff_profiles WHERE user_id = $1 AND organization_id = $2 LIMIT 1',
        [userId, orgId]
      );
      const trainerProfileId = trainerProfRes.rows[0]?.id || -1;
      params.push(trainerProfileId);
      query += ` AND pte.trainer_id = $${params.length}`;
    }

    if (branch_id && !isNaN(parseInt(branch_id, 10))) {
      params.push(parseInt(branch_id, 10));
      query += ` AND m.primary_branch_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND pte.status = $${params.length}`;
    }
    if (member_id) {
      params.push(parseInt(member_id, 10));
      query += ` AND pte.member_id = $${params.length}`;
    }

    query += ` ORDER BY pte.id DESC`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 6. GET SESSION AUDIT LOGS FOR AN ENROLLMENT
// ================================================================
exports.getSessionLogs = async (req, res) => {
  const { enrollmentId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT pts.*, pte.sessions_total
       FROM personal_training_sessions pts
       JOIN personal_training_enrollments pte ON pte.id = pts.enrollment_id
       WHERE pts.enrollment_id = $1 
       ORDER BY pts.actual_start DESC`,
      [parseInt(enrollmentId, 10)]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};