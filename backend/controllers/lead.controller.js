const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// 1. Create Walk-in Lead / Inquiry
exports.createLead = async (req, res) => {
  const orgId = req.user.orgId;
  const {
    branch_id,
    first_name,
    last_name,
    phone,
    email,
    interested_plan_id,
    expected_join_date,
    notes
  } = req.body;

  if (!branch_id || !first_name || !phone) {
    return res.status(400).json({ success: false, message: 'branch_id, first_name, aur phone required hain.' });
  }

  try {
    const hashId = generateHashId('led_');
    const query = `
      INSERT INTO leads (
        hash_id, organization_id, branch_id, first_name, last_name,
        phone, email, status, interested_plan_id, expected_join_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      hashId, orgId, branch_id, first_name, last_name || null,
      phone, email || null, interested_plan_id || null, expected_join_date || null, notes || null
    ];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Lead recorded successfully.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Add Follow-up Note/Date
exports.addFollowup = async (req, res) => {
  const userId = req.user.userId;
  const { lead_id, followup_at, notes, outcome } = req.body;

  if (!lead_id || !followup_at) {
    return res.status(400).json({ success: false, message: 'lead_id aur followup_at zaroori hain.' });
  }

  try {
    const hashId = generateHashId('fup_');
    const query = `
      INSERT INTO lead_followups (
        hash_id, lead_id, assigned_to, followup_at, notes, outcome
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [hashId, lead_id, userId, followup_at, notes || null, outcome || null]);

    // Update lead status to 'contacted'
    await db.query("UPDATE leads SET status = 'contacted', updated_at = NOW() WHERE id = $1", [lead_id]);

    return res.status(201).json({ success: true, message: 'Follow-up scheduled.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Convert Lead Directly to Full Member
exports.convertLeadToMember = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const userId = req.user.userId;
  const { lead_id, member_code } = req.body;

  if (!lead_id || !member_code) {
    return res.status(400).json({ success: false, message: 'lead_id aur member_code zaroori hain.' });
  }

  try {
    await client.query('BEGIN');

    // Fetch lead details
    const leadRes = await client.query('SELECT * FROM leads WHERE id = $1 AND organization_id = $2', [lead_id, orgId]);
    if (leadRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Lead nahi mili.' });
    }
    const lead = leadRes.rows[0];

    // Insert into members
    const memberHashId = generateHashId('mbr_');
    const memberQuery = `
      INSERT INTO members (
        hash_id, organization_id, primary_branch_id, member_code,
        first_name, last_name, phone, email, status, join_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', CURRENT_DATE, $9)
      RETURNING id, hash_id, member_code, first_name, phone;
    `;
    const memberRes = await client.query(memberQuery, [
      memberHashId, orgId, lead.branch_id, member_code,
      lead.first_name, lead.last_name, lead.phone, lead.email, userId
    ]);
    const member = memberRes.rows[0];

    // Update lead status to 'converted'
    await client.query(
      "UPDATE leads SET status = 'converted', converted_member_id = $1, updated_at = NOW() WHERE id = $2",
      [member.id, lead.id]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Lead safalta-purvak Member me convert ho gayi.',
      data: member
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};