const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// Helper function: Accepts numeric ID or hash_id (e.g. 'mbr_...')
const resolveMemberId = async (client, memberIdentifier, orgId) => {
  if (!memberIdentifier) return null;

  // Agar already numeric ID hai
  if (!isNaN(memberIdentifier) && !String(memberIdentifier).startsWith('mbr_')) {
    return parseInt(memberIdentifier, 10);
  }

  // Agar hash_id hai toh DB se numeric ID nikalein
  const res = await client.query(
    'SELECT id FROM members WHERE hash_id = $1 AND organization_id = $2 AND deleted_at IS NULL',
    [String(memberIdentifier).trim(), orgId]
  );

  return res.rows.length > 0 ? res.rows[0].id : null;
};

exports.assignMembership = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const userId = req.user.userId;

  const {
    member_id,
    plan_id,
    branch_id,
    start_date,
    discount_amount = 0.00,
    paid_amount = 0.00
  } = req.body;

  const finalBranchId = branch_id ? parseInt(branch_id, 10) : (req.user.branch_id || req.user.branchId);

  if (!member_id || !plan_id || !finalBranchId || !start_date) {
    client.release();
    return res.status(400).json({
      success: false,
      message: 'member_id, plan_id, branch_id, aur start_date zaroori hain.'
    });
  }

  try {
    await client.query('BEGIN');

    // 1. Resolve & verify Member
    const targetMemberId = await resolveMemberId(client, member_id, orgId);
    if (!targetMemberId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Member record nahi mila is gym me.' });
    }

    // 2. Fetch Plan details
    const parsedPlanId = parseInt(plan_id, 10);
    const planRes = await client.query(
      'SELECT id, name, duration_days, base_price, tax_percentage FROM membership_plans WHERE id = $1 AND organization_id = $2 AND is_active = TRUE',
      [parsedPlanId, orgId]
    );

    if (planRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Membership plan active nahi hai ya nahi mila.' });
    }
    const plan = planRes.rows[0];

    // 3. Calculate End Date & Pricing
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + Number(plan.duration_days));
    const endDateStr = endDateObj.toISOString().split('T')[0];

    const basePrice = parseFloat(plan.base_price || 0);
    const taxRate = parseFloat(plan.tax_percentage || 0);
    const taxAmt = (basePrice * taxRate) / 100;
    const grossTotal = basePrice + taxAmt;
    const finalDiscount = parseFloat(discount_amount || 0);
    const finalTotal = Math.max(0, grossTotal - finalDiscount);
    const finalPaid = parseFloat(paid_amount || 0);

    // 4. Insert Membership
    const msHashId = generateHashId('msp_');
    const msQuery = `
      INSERT INTO memberships (
        hash_id, organization_id, branch_id, member_id, plan_id,
        start_date, end_date, status, total_amount, paid_amount,
        discount_amount, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11)
      RETURNING id, hash_id, start_date, end_date, status, total_amount, paid_amount;
    `;
    const msRes = await client.query(msQuery, [
      msHashId,
      orgId,
      finalBranchId,
      targetMemberId,
      parsedPlanId,
      start_date,
      endDateStr,
      finalTotal,
      finalPaid,
      finalDiscount,
      userId
    ]);
    const newMembership = msRes.rows[0];

    // 5. Audit Log
    const auditHashId = generateHashId('adt_');
    await client.query(
      `INSERT INTO audit_logs (
        hash_id, organization_id, user_id, branch_id,
        action, entity_type, entity_id, new_data
      ) VALUES ($1, $2, $3, $4, 'ASSIGN_MEMBERSHIP', 'memberships', $5, $6);`,
      [
        auditHashId,
        orgId,
        userId,
        finalBranchId,
        newMembership.id,
        JSON.stringify({ plan_name: plan.name, end_date: endDateStr, total: finalTotal })
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Membership plan member ko assign ho gaya.',
      data: {
        ...newMembership,
        due_amount: Math.max(0, finalTotal - finalPaid)
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign Membership Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};