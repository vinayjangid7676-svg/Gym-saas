const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 0. FETCH ALL SUB-RECORDS FOR A MEMBER (GET API)
// ================================================================
exports.getMemberSubrecords = async (req, res) => {
  const orgId = req.user.orgId;
  const { member_id } = req.params;

  if (!member_id) {
    return res.status(400).json({ success: false, message: 'member_id param zaroori hai.' });
  }

  try {
    const [
      emergencyRes,
      documentsRes,
      notesRes,
      tagsRes,
      conditionsRes,
      injuriesRes,
      goalsRes,
      compositionRes,
      renewalsRes
    ] = await Promise.all([
      db.query('SELECT * FROM member_emergency_contacts WHERE member_id = $1 ORDER BY is_primary DESC, id DESC', [member_id]),
      db.query('SELECT * FROM member_documents WHERE member_id = $1 ORDER BY id DESC', [member_id]),
      db.query(`
        SELECT mn.*, u.name as author_name 
        FROM member_notes mn 
        LEFT JOIN users u ON u.id = mn.author_user_id 
        WHERE mn.member_id = $1 AND mn.organization_id = $2 
        ORDER BY mn.id DESC
      `, [member_id, orgId]),
      db.query(`
        SELECT mt.id, mt.name, mt.color 
        FROM member_tags mt 
        JOIN member_tag_assignments mta ON mta.tag_id = mt.id 
        WHERE mta.member_id = $1
      `, [member_id]),
      db.query('SELECT * FROM member_medical_conditions WHERE member_id = $1 ORDER BY id DESC', [member_id]),
      db.query('SELECT * FROM member_injuries WHERE member_id = $1 ORDER BY id DESC', [member_id]),
      db.query('SELECT * FROM member_goals WHERE member_id = $1 ORDER BY id DESC', [member_id]),
      db.query('SELECT * FROM member_body_composition WHERE member_id = $1 ORDER BY recorded_at DESC', [member_id]),
      db.query(`
        SELECT mr.*, mp.name as plan_name, u.name as renewed_by_name
        FROM membership_renewals mr
        JOIN memberships m ON m.id = mr.new_membership_id
        LEFT JOIN membership_plans mp ON mp.id = m.plan_id
        LEFT JOIN users u ON u.id = mr.renewed_by
        WHERE m.member_id = $1
        ORDER BY mr.id DESC
      `, [member_id])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        emergency_contacts: emergencyRes.rows,
        documents: documentsRes.rows,
        notes: notesRes.rows,
        tags: tagsRes.rows,
        medical_conditions: conditionsRes.rows,
        injuries: injuriesRes.rows,
        goals: goalsRes.rows,
        body_composition: compositionRes.rows,
        renewals: renewalsRes.rows
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 1. MEMBER SUB-RECORDS (Section 3)
// ================================================================

// Emergency Contact
exports.addEmergencyContact = async (req, res) => {
  const { member_id, name, relationship, phone, alternate_phone, email, is_primary = false } = req.body;
  if (!member_id || !name || !phone) {
    return res.status(400).json({ success: false, message: 'member_id, name aur phone required hain.' });
  }
  try {
    const hashId = generateHashId('emc_');
    const query = `
      INSERT INTO member_emergency_contacts (
        hash_id, member_id, name, relationship, phone, alternate_phone, email, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, member_id, name, relationship || null, phone, alternate_phone || null, email || null, is_primary
    ]);
    return res.status(201).json({ success: true, message: 'Emergency contact added.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Document Upload Record
exports.addMemberDocument = async (req, res) => {
  const userId = req.user.userId;
  const { member_id, document_type, document_number, document_url, issued_on, expires_on } = req.body;
  if (!member_id || !document_type) {
    return res.status(400).json({ success: false, message: 'member_id aur document_type required hain.' });
  }
  try {
    const hashId = generateHashId('doc_');
    const query = `
      INSERT INTO member_documents (
        hash_id, member_id, document_type, document_number, document_url,
        issued_on, expires_on, verification_status, verified_by, verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'verified', $8, NOW())
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, member_id, document_type, document_number || null, document_url || null,
      issued_on || null, expires_on || null, userId
    ]);
    return res.status(201).json({ success: true, message: 'Member document saved.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Internal Staff Note for Member
exports.addMemberNote = async (req, res) => {
  const orgId = req.user.orgId;
  const userId = req.user.userId;
  const { member_id, note_type = 'general', note, is_private = true } = req.body;
  if (!member_id || !note) {
    return res.status(400).json({ success: false, message: 'member_id aur note required hain.' });
  }
  try {
    const hashId = generateHashId('not_');
    const query = `
      INSERT INTO member_notes (
        hash_id, organization_id, member_id, author_user_id, note_type, note, is_private
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, orgId, member_id, userId, note_type, note, is_private
    ]);
    return res.status(201).json({ success: true, message: 'Member note recorded.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Tags Management (Create Tag & Assign to Member)
exports.createAndAssignTag = async (req, res) => {
  const orgId = req.user.orgId;
  const { member_id, name, color = '#FF5733' } = req.body;
  if (!name || !member_id) {
    return res.status(400).json({ success: false, message: 'name aur member_id zaroori hain.' });
  }
  try {
    let tagRes = await db.query(
      'SELECT id FROM member_tags WHERE organization_id = $1 AND name = $2',
      [orgId, name.trim()]
    );
    let tagId;
    if (tagRes.rows.length === 0) {
      const tagHashId = generateHashId('tag_');
      const insRes = await db.query(
        'INSERT INTO member_tags (hash_id, organization_id, name, color) VALUES ($1, $2, $3, $4) RETURNING id',
        [tagHashId, orgId, name.trim(), color]
      );
      tagId = insRes.rows[0].id;
    } else {
      tagId = tagRes.rows[0].id;
    }
    await db.query(
      'INSERT INTO member_tag_assignments (member_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [member_id, tagId]
    );
    return res.status(201).json({ success: true, message: `Tag "${name}" assigned to member.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. CRM ACTIVITIES & STATUS AUDIT (Section 4)
// ================================================================
exports.updateLeadStatus = async (req, res) => {
  const client = await db.connect();
  const userId = req.user.userId;
  const { lead_id, new_status } = req.body;
  if (!lead_id || !new_status) {
    return res.status(400).json({ success: false, message: 'lead_id aur new_status required hain.' });
  }
  try {
    await client.query('BEGIN');
    const leadRes = await client.query('SELECT status FROM leads WHERE id = $1 FOR UPDATE', [lead_id]);
    if (leadRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Lead nahi mili.' });
    }
    const oldStatus = leadRes.rows[0].status;
    await client.query('UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2', [new_status, lead_id]);
    await client.query(
      `INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [lead_id, oldStatus, new_status, userId]
    );
    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: `Lead status changed: ${oldStatus} -> ${new_status}` });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.logLeadActivity = async (req, res) => {
  const userId = req.user.userId;
  const { lead_id, activity_type, description } = req.body;
  if (!lead_id || !activity_type) {
    return res.status(400).json({ success: false, message: 'lead_id aur activity_type required hain.' });
  }
  try {
    const hashId = generateHashId('act_');
    const query = `
      INSERT INTO lead_activities (hash_id, lead_id, activity_type, description, performed_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [hashId, lead_id, activity_type, description || null, userId]);
    return res.status(201).json({ success: true, message: 'Lead activity logged.', activity: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. MEMBERSHIP RENEWALS (Section 5)
// ================================================================
exports.renewMembership = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const userId = req.user.userId;
  const { old_membership_id, plan_id, total_amount, paid_amount = 0.00 } = req.body;
  if (!old_membership_id || !plan_id || !total_amount) {
    return res.status(400).json({ success: false, message: 'old_membership_id, plan_id aur total_amount zaroori hain.' });
  }
  try {
    await client.query('BEGIN');
    const oldMsRes = await client.query('SELECT * FROM memberships WHERE id = $1 FOR UPDATE', [old_membership_id]);
    if (oldMsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Purani membership nahi mili.' });
    }
    const oldMs = oldMsRes.rows[0];
    const planRes = await client.query('SELECT duration_days FROM membership_plans WHERE id = $1', [plan_id]);
    if (planRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Naya plan exist nahi karta.' });
    }
    const durationDays = planRes.rows[0].duration_days;
    const oldEndDate = new Date(oldMs.end_date);
    const today = new Date();
    const startDateObj = oldEndDate > today ? new Date(oldEndDate.getTime() + 86400000) : today;
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + durationDays);
    const startStr = startDateObj.toISOString().split('T')[0];
    const endStr = endDateObj.toISOString().split('T')[0];

    const newMsHashId = generateHashId('msp_');
    const newMsQuery = `
      INSERT INTO memberships (
        hash_id, organization_id, branch_id, member_id, plan_id,
        start_date, end_date, status, total_amount, paid_amount, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)
      RETURNING id, hash_id, start_date, end_date, status;
    `;
    const newMsRes = await client.query(newMsQuery, [
      newMsHashId, orgId, oldMs.branch_id, oldMs.member_id, plan_id,
      startStr, endStr, total_amount, paid_amount, userId
    ]);
    const newMs = newMsRes.rows[0];

    const renewalHashId = generateHashId('rnw_');
    const rnwQuery = `
      INSERT INTO membership_renewals (
        hash_id, old_membership_id, new_membership_id, renewed_at, renewed_by
      ) VALUES ($1, $2, $3, NOW(), $4)
      RETURNING *;
    `;
    const rnwRes = await client.query(rnwQuery, [renewalHashId, oldMs.id, newMs.id, userId]);

    await client.query("UPDATE memberships SET status = 'expired' WHERE id = $1", [oldMs.id]);
    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Membership safely renewed.',
      renewal: rnwRes.rows[0],
      new_membership: newMs
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. HEALTH, CONDITIONS & INJURIES (Section 7)
// ================================================================
exports.addMedicalCondition = async (req, res) => {
  const { member_id, condition_name, severity = 'moderate', notes, diagnosed_on } = req.body;
  if (!member_id || !condition_name) {
    return res.status(400).json({ success: false, message: 'member_id aur condition_name zaroori hain.' });
  }
  try {
    const hashId = generateHashId('mcn_');
    const query = `
      INSERT INTO member_medical_conditions (
        hash_id, member_id, condition_name, severity, notes, diagnosed_on, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, member_id, condition_name, severity, notes || null, diagnosed_on || null
    ]);
    return res.status(201).json({ success: true, message: 'Medical condition recorded.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.addInjury = async (req, res) => {
  const { member_id, injury_name, body_part, occurred_on, notes } = req.body;
  if (!member_id || !injury_name) {
    return res.status(400).json({ success: false, message: 'member_id aur injury_name required hain.' });
  }
  try {
    const hashId = generateHashId('inj_');
    const query = `
      INSERT INTO member_injuries (
        hash_id, member_id, injury_name, body_part, occurred_on, notes, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, member_id, injury_name, body_part || null, occurred_on || null, notes || null
    ]);
    return res.status(201).json({ success: true, message: 'Injury history logged.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.addGoal = async (req, res) => {
  const { member_id, goal_type, title, target_value, unit, target_date } = req.body;
  if (!member_id || !goal_type || !title) {
    return res.status(400).json({ success: false, message: 'member_id, goal_type, aur title required hain.' });
  }
  try {
    const hashId = generateHashId('gol_');
    const query = `
      INSERT INTO member_goals (
        hash_id, member_id, goal_type, title, target_value, unit, target_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, member_id, goal_type, title, target_value || null, unit || null, target_date || null
    ]);
    return res.status(201).json({ success: true, message: 'Fitness goal added.', goal: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.addBodyComposition = async (req, res) => {
  const {
    member_id, visceral_fat, water_percent, bone_mass_kg,
    basal_metabolic_rate, metabolic_age, device_name, notes
  } = req.body;
  if (!member_id) {
    return res.status(400).json({ success: false, message: 'member_id required hai.' });
  }
  try {
    const hashId = generateHashId('cmp_');
    const query = `
      INSERT INTO member_body_composition (
        hash_id, member_id, recorded_at, visceral_fat, water_percent,
        bone_mass_kg, basal_metabolic_rate, metabolic_age, device_name, notes
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, member_id, visceral_fat || null, water_percent || null,
      bone_mass_kg || null, basal_metabolic_rate || null, metabolic_age || null,
      device_name || 'InBody 270', notes || null
    ]);
    return res.status(201).json({ success: true, message: 'Body composition scan saved.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};