const crypto = require('crypto');
const db = require('../config/db');

// 1. Create a New Membership Plan
exports.createPlan = async (req, res) => {
  const orgId = req.orgId;
  const currentBranchId = req.branchId;
  const {
    branch_id,
    name,
    description,
    duration_days,
    session_count,
    base_price,
    tax_percentage = 0.0,
    allow_freezes = false,
    max_freeze_days = 0,
    auto_renew = false
  } = req.body;

  if (!name || !duration_days || base_price === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Plan Name, duration_days aur base_price required parameters hain.'
    });
  }

  const parsedDuration = parseInt(duration_days, 10);
  const parsedPrice = parseFloat(base_price);
  const parsedTax = parseFloat(tax_percentage || 0);

  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    return res.status(400).json({ success: false, message: 'duration_days valid positive number hona chahiye.' });
  }

  if (isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ success: false, message: 'base_price valid non-negative number hona chahiye.' });
  }

  // Branch isolation validation
  let targetBranchId = branch_id !== undefined ? branch_id : currentBranchId;
  if (targetBranchId) {
    targetBranchId = parseInt(targetBranchId, 10);
    const branchCheck = await db.query(
      `SELECT id FROM branches WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [targetBranchId, orgId]
    );
    if (branchCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Specified branch is invalid or does not belong to your gym.' });
    }
  }

  const hashId = `pln_${crypto.randomBytes(12).toString('hex')}`;

  try {
    const query = `
      INSERT INTO membership_plans (
        hash_id, organization_id, branch_id, name, description, duration_days,
        session_count, base_price, tax_percentage, allow_freezes, max_freeze_days, auto_renew, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
      RETURNING *;
    `;
    const values = [
      hashId,
      orgId,
      targetBranchId || null,
      name.trim(),
      description ? description.trim() : null,
      parsedDuration,
      session_count ? parseInt(session_count, 10) : null,
      parsedPrice,
      parsedTax,
      Boolean(allow_freezes),
      allow_freezes ? parseInt(max_freeze_days || 0, 10) : 0,
      Boolean(auto_renew)
    ];

    const { rows } = await db.query(query, values);
    return res.status(201).json({
      success: true,
      message: 'Membership plan created successfully.',
      data: rows[0]
    });
  } catch (error) {
    console.error('Plan Creation Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create plan.', error: error.message });
  }
};

// 2. Get All Plans for Logged in Gym & Active Branch
exports.getPlans = async (req, res) => {
  const orgId = req.orgId;
  const branchId = req.branchId;

  try {
    // Agar branch selected hai: us branch ke specific plans + jo saari branches ke liye common hain (branch_id IS NULL)
    let query;
    let values;

    if (branchId) {
      query = `
        SELECT p.*, b.name AS branch_name
        FROM membership_plans p
        LEFT JOIN branches b ON b.id = p.branch_id
        WHERE p.organization_id = $1 
          AND (p.branch_id = $2 OR p.branch_id IS NULL)
          AND p.is_active = TRUE
        ORDER BY p.id DESC;
      `;
      values = [orgId, branchId];
    } else {
      query = `
        SELECT p.*, b.name AS branch_name
        FROM membership_plans p
        LEFT JOIN branches b ON b.id = p.branch_id
        WHERE p.organization_id = $1 AND p.is_active = TRUE
        ORDER BY p.id DESC;
      `;
      values = [orgId];
    }

    const { rows } = await db.query(query, values);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Fetch Plans Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch membership plans.', error: error.message });
  }
};

// 3. Update Membership Plan
exports.updatePlan = async (req, res) => {
  const orgId = req.orgId;
  const { planIdentifier } = req.params; // Supports hash_id or internal numeric id
  const {
    name,
    description,
    duration_days,
    session_count,
    base_price,
    tax_percentage,
    allow_freezes,
    max_freeze_days,
    is_active
  } = req.body;

  try {
    const isNumeric = /^\d+$/.test(planIdentifier);
    const lookupField = isNumeric ? 'id' : 'hash_id';

    const existingRes = await db.query(
      `SELECT * FROM membership_plans WHERE ${lookupField} = $1 AND organization_id = $2`,
      [planIdentifier, orgId]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Membership plan not found.' });
    }

    const current = existingRes.rows[0];

    const updateQuery = `
      UPDATE membership_plans
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        duration_days = COALESCE($3, duration_days),
        session_count = $4,
        base_price = COALESCE($5, base_price),
        tax_percentage = COALESCE($6, tax_percentage),
        allow_freezes = COALESCE($7, allow_freezes),
        max_freeze_days = COALESCE($8, max_freeze_days),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
      WHERE id = $10 AND organization_id = $11
      RETURNING *;
    `;

    const values = [
      name !== undefined ? name.trim() : null,
      description !== undefined ? description.trim() : null,
      duration_days !== undefined ? parseInt(duration_days, 10) : null,
      session_count !== undefined ? (session_count ? parseInt(session_count, 10) : null) : current.session_count,
      base_price !== undefined ? parseFloat(base_price) : null,
      tax_percentage !== undefined ? parseFloat(tax_percentage) : null,
      allow_freezes !== undefined ? Boolean(allow_freezes) : null,
      max_freeze_days !== undefined ? parseInt(max_freeze_days, 10) : null,
      is_active !== undefined ? Boolean(is_active) : null,
      current.id,
      orgId
    ];

    const { rows } = await db.query(updateQuery, values);
    return res.json({
      success: true,
      message: 'Membership plan updated successfully.',
      data: rows[0]
    });
  } catch (error) {
    console.error('Update Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update plan.', error: error.message });
  }
};

// 4. Soft Delete Membership Plan
exports.deletePlan = async (req, res) => {
  const orgId = req.orgId;
  const { planIdentifier } = req.params;

  try {
    const isNumeric = /^\d+$/.test(planIdentifier);
    const lookupField = isNumeric ? 'id' : 'hash_id';

    // Check if memberships are actively using this plan
    const checkActiveUsage = await db.query(
      `SELECT m.id FROM memberships m
       JOIN membership_plans p ON p.id = m.plan_id
       WHERE p.${lookupField} = $1 AND p.organization_id = $2 AND m.status = 'active'
       LIMIT 1`,
      [planIdentifier, orgId]
    );

    if (checkActiveUsage.rows.length > 0) {
      // Soft-deactivate if active members are enrolled
      await db.query(
        `UPDATE membership_plans SET is_active = FALSE, updated_at = NOW() WHERE ${lookupField} = $1 AND organization_id = $2`,
        [planIdentifier, orgId]
      );
      return res.json({
        success: true,
        message: 'Plan has active memberships. It has been deactivated to preserve financial integrity.'
      });
    }

    const deleteRes = await db.query(
      `UPDATE membership_plans SET is_active = FALSE, updated_at = NOW() WHERE ${lookupField} = $1 AND organization_id = $2 RETURNING id`,
      [planIdentifier, orgId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }

    return res.json({ success: true, message: 'Membership plan deleted successfully.' });
  } catch (error) {
    console.error('Delete Plan Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete plan.', error: error.message });
  }
};