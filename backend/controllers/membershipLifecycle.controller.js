const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// Helper function to resolve ID or Hash ID to internal DB Integer ID
const resolveMembershipId = async (clientOrDb, identifier) => {
  if (!identifier) return null;
  if (!isNaN(identifier) && Number.isInteger(Number(identifier))) {
    return parseInt(identifier, 10);
  }
  const res = await clientOrDb.query(
    `SELECT id FROM memberships WHERE hash_id = $1 LIMIT 1`,
    [identifier]
  );
  return res.rows.length > 0 ? res.rows[0].id : null;
};

// Helper function to resolve Member Hash ID or ID
const resolveMemberId = async (clientOrDb, identifier) => {
  if (!identifier) return null;
  if (!isNaN(identifier) && Number.isInteger(Number(identifier))) {
    return parseInt(identifier, 10);
  }
  const res = await clientOrDb.query(
    `SELECT id FROM members WHERE hash_id = $1 LIMIT 1`,
    [identifier]
  );
  return res.rows.length > 0 ? res.rows[0].id : null;
};

// Helper function to resolve Addon Hash ID or ID
const resolveAddonId = async (clientOrDb, identifier) => {
  if (!identifier) return null;
  if (!isNaN(identifier) && Number.isInteger(Number(identifier))) {
    return parseInt(identifier, 10);
  }
  const res = await clientOrDb.query(
    `SELECT id FROM membership_addons WHERE hash_id = $1 LIMIT 1`,
    [identifier]
  );
  return res.rows.length > 0 ? res.rows[0].id : null;
};

// A small denylist of keywords that strongly suggest someone is
// trying to model a physical, single-occupancy asset as a generic
// addon. This is a soft guardrail (warns/blocks obvious cases) —
// the real enforcement is the explicit `is_physical_inventory` flag
// the caller must set, which we hard-reject below.
const PHYSICAL_INVENTORY_KEYWORDS = ['locker', 'cabinet', 'rfid card', 'access card'];

// ================================================================
// GET MEMBER DETAIL WITH LIFECYCLE LOGS & ADDONS
// ================================================================
exports.getMemberById = async (req, res) => {
  const { hashId } = req.params;
  const orgId = req.user.orgId;
  try {
    const memberRes = await db.query(
      `SELECT * FROM members WHERE hash_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [hashId, orgId]
    );
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member record nahi mila.' });
    }
    const member = memberRes.rows[0];

    const msRes = await db.query(
      `SELECT m.*, p.name as plan_name
       FROM memberships m
       LEFT JOIN membership_plans p ON m.plan_id = p.id
       WHERE m.member_id = $1 AND m.organization_id = $2
       ORDER BY m.id DESC LIMIT 1`,
      [member.id, orgId]
    );

    const activeMembership = msRes.rows[0] || null;
    let addons = [];
    let lifecycleLogs = [];
    let lockers = [];

    if (activeMembership) {
      const addonsRes = await db.query(
        `SELECT mma.id, ma.name, ma.description, mma.price, mma.quantity
         FROM member_membership_addons mma
         JOIN membership_addons ma ON ma.id = mma.addon_id
         WHERE mma.membership_id = $1`,
        [activeMembership.id]
      );
      addons = addonsRes.rows;

      // Surface active locker allocations for this member alongside
      // the lifecycle view, since lockers are billed through the
      // same member but live in their own table now.
      const lockersRes = await db.query(
        `SELECT la.hash_id, la.start_date, la.end_date, la.monthly_rent,
                la.security_deposit, la.status, l.locker_number
         FROM locker_allocations la
         JOIN lockers l ON l.id = la.locker_id
         WHERE la.member_id = $1 AND la.organization_id = $2
         ORDER BY la.created_at DESC`,
        [member.id, orgId]
      );
      lockers = lockersRes.rows;

      const logsRes = await db.query(
        `
        SELECT
          f.id,
          'FREEZE' as action,
          f.reason as notes,
          f.created_at,
          f.start_date,
          f.end_date,
          u.name as performed_by
        FROM membership_freezes f
        LEFT JOIN users u ON u.id = f.approved_by
        WHERE f.membership_id = $1
        UNION ALL
        SELECT
          e.id,
          'EXTEND' as action,
          CONCAT('Extended by ', e.days_added, ' days. Reason: ', COALESCE(e.reason, 'N/A')) as notes,
          e.created_at,
          e.old_end_date as start_date,
          e.new_end_date as end_date,
          u.name as performed_by
        FROM membership_extensions e
        LEFT JOIN users u ON u.id = e.approved_by
        WHERE e.membership_id = $1
        UNION ALL
        SELECT
          t.id,
          'TRANSFER' as action,
          CONCAT('Transferred membership. Fee: ₹', t.transfer_fee, '. Reason: ', COALESCE(t.reason, 'N/A')) as notes,
          t.created_at,
          NULL as start_date,
          NULL as end_date,
          u.name as performed_by
        FROM membership_transfers t
        LEFT JOIN users u ON u.id = t.approved_by
        WHERE t.membership_id = $1
        ORDER BY created_at DESC
        `,
        [activeMembership.id]
      );

      lifecycleLogs = logsRes.rows;
    }

    return res.status(200).json({
      success: true,
      data: {
        ...member,
        active_membership: activeMembership,
        addons,
        lockers,
        lifecycle_logs: lifecycleLogs
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 1. MEMBERSHIP FREEZE (PAUSE MEMBERSHIP)
// ================================================================
exports.freezeMembership = async (req, res) => {
  const client = await db.connect();
  const userId = req.user.userId;
  const orgId = req.user.orgId;
  const { membership_id, start_date, end_date, reason } = req.body;

  if (!membership_id || !start_date || !end_date) {
    return res.status(400).json({
      success: false,
      message: 'membership_id, start_date aur end_date zaroori hain.'
    });
  }

  try {
    await client.query('BEGIN');

    const targetMsId = await resolveMembershipId(client, membership_id);
    if (!targetMsId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Membership record nahi mila.' });
    }

    const msRes = await client.query(
      'SELECT id, status, end_date FROM memberships WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [targetMsId, orgId]
    );

    if (msRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Membership nahi mili.' });
    }

    const currentMs = msRes.rows[0];
    if (currentMs.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Sirf active memberships freeze ho sakti hain. Current status: ${currentMs.status}`
      });
    }

    const freezeHashId = generateHashId('frz_');
    const freezeQuery = `
      INSERT INTO membership_freezes (
        hash_id, membership_id, start_date, end_date, reason, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const freezeRes = await client.query(freezeQuery, [
      freezeHashId, targetMsId, start_date, end_date, reason || null, userId
    ]);

    await client.query(
      "UPDATE memberships SET status = 'frozen', updated_at = NOW() WHERE id = $1",
      [targetMsId]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Membership safely freeze ho gayi hai.',
      freeze: freezeRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 2. MEMBERSHIP EXTENSION (ADD COMPLIMENTARY DAYS)
// ================================================================
exports.extendMembership = async (req, res) => {
  const client = await db.connect();
  const userId = req.user.userId;
  const orgId = req.user.orgId;
  const { membership_id, days_added, reason } = req.body;

  if (!membership_id || !days_added || parseInt(days_added, 10) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'membership_id aur positive days_added required hain.'
    });
  }

  try {
    await client.query('BEGIN');

    const targetMsId = await resolveMembershipId(client, membership_id);
    if (!targetMsId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Membership record nahi mila.' });
    }

    const msRes = await client.query(
      'SELECT id, end_date FROM memberships WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [targetMsId, orgId]
    );

    if (msRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Membership record nahi mila.' });
    }

    const oldEndDate = new Date(msRes.rows[0].end_date);
    const newEndDate = new Date(oldEndDate);
    newEndDate.setDate(oldEndDate.getDate() + parseInt(days_added, 10));

    const oldEndStr = oldEndDate.toISOString().split('T')[0];
    const newEndStr = newEndDate.toISOString().split('T')[0];

    const extHashId = generateHashId('ext_');
    const extQuery = `
      INSERT INTO membership_extensions (
        hash_id, membership_id, days_added, old_end_date, new_end_date, reason, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const extRes = await client.query(extQuery, [
      extHashId, targetMsId, days_added, oldEndStr, newEndStr, reason || null, userId
    ]);

    await client.query(
      'UPDATE memberships SET end_date = $1, updated_at = NOW() WHERE id = $2',
      [newEndStr, targetMsId]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `Membership ${days_added} dino ke liye extend ho gayi.`,
      extension: extRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 3. MEMBERSHIP TRANSFER (MEMBER A TO MEMBER B)
// ================================================================
exports.transferMembership = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const userId = req.user.userId;
  const { membership_id, from_member_id, to_member_id, transfer_fee = 0.00, reason } = req.body;

  if (!membership_id || !from_member_id || !to_member_id) {
    return res.status(400).json({
      success: false,
      message: 'membership_id, from_member_id aur to_member_id zaroori hain.'
    });
  }

  try {
    await client.query('BEGIN');

    const targetMsId = await resolveMembershipId(client, membership_id);
    const targetFromMemberId = await resolveMemberId(client, from_member_id);
    const targetToMemberId = await resolveMemberId(client, to_member_id);

    if (!targetMsId || !targetFromMemberId || !targetToMemberId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Invalid membership ya member references.' });
    }

    const msRes = await client.query(
      'SELECT * FROM memberships WHERE id = $1 AND member_id = $2 AND organization_id = $3 FOR UPDATE',
      [targetMsId, targetFromMemberId, orgId]
    );

    if (msRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Valid active membership nahi mili.' });
    }

    const oldMs = msRes.rows[0];
    const trfHashId = generateHashId('mtf_');
    const trfQuery = `
      INSERT INTO membership_transfers (
        hash_id, membership_id, from_member_id, to_member_id, transfer_fee, reason, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const trfRes = await client.query(trfQuery, [
      trfHashId, targetMsId, targetFromMemberId, targetToMemberId, transfer_fee, reason || null, userId
    ]);

    const newMsHashId = generateHashId('msp_');
    const newMsQuery = `
      INSERT INTO memberships (
        hash_id, organization_id, branch_id, member_id, plan_id,
        start_date, end_date, status, total_amount, paid_amount,
        discount_amount, transferred_from_membership_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, 'active', $7, $7, 0, $8, $9)
      RETURNING *;
    `;
    const newMsRes = await client.query(newMsQuery, [
      newMsHashId, orgId, oldMs.branch_id, targetToMemberId, oldMs.plan_id,
      oldMs.end_date, transfer_fee, oldMs.id, userId
    ]);

    await client.query(
      "UPDATE memberships SET status = 'transferred', updated_at = NOW() WHERE id = $1",
      [targetMsId]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Membership successfully transfer ho gayi.',
      transfer_log: trfRes.rows[0],
      new_membership: newMsRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. ADD-ONS MANAGEMENT
//    (non-physical extras only — see file header comment)
// ================================================================
exports.createAddon = async (req, res) => {
  const orgId = req.user.orgId;
  const { name, description, price, duration_days, is_physical_inventory } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ success: false, message: 'name aur price required hain.' });
  }

  // Hard reject: physical, limited-inventory items don't belong in
  // the generic addon catalog. Redirect the caller to the correct
  // module instead of silently creating a broken record.
  if (is_physical_inventory === true) {
    return res.status(400).json({
      success: false,
      message: 'Physical inventory items (jaise locker) addon catalog se create nahi ho sakte. Lockers module (/api/v1/lockers) use karein.'
    });
  }

  const nameLower = name.trim().toLowerCase();
  if (PHYSICAL_INVENTORY_KEYWORDS.some((kw) => nameLower.includes(kw))) {
    return res.status(400).json({
      success: false,
      message: `"${name}" jaisa physical/limited-inventory item lagta hai. Agar ye locker hai, kripya lockers module (/api/v1/lockers) use karein — addon catalog sirf unlimited-supply extras (PT packs, diet consultation, etc.) ke liye hai. Agar ye galat detect hua hai aur genuinely ek unlimited-supply addon hai, to naam thoda specific rakhein.`
    });
  }

  try {
    const hashId = generateHashId('ado_');
    const query = `
      INSERT INTO membership_addons (
        hash_id, organization_id, name, description, price, duration_days, is_active, is_physical_inventory
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, orgId, name.trim(), description || null, price, duration_days || null
    ]);
    return res.status(201).json({ success: true, message: 'Add-on created.', addon: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.attachAddonToMembership = async (req, res) => {
  const orgId = req.user.orgId;
  const { membership_id, addon_id, quantity = 1, price } = req.body;

  if (!membership_id || !addon_id || price === undefined) {
    return res.status(400).json({
      success: false,
      message: 'membership_id, addon_id, aur price required hain.'
    });
  }

  try {
    const targetMsId = await resolveMembershipId(db, membership_id);
    const targetAddonId = await resolveAddonId(db, addon_id);

    if (!targetMsId || !targetAddonId) {
      return res.status(404).json({
        success: false,
        message: 'Membership ya Addon record nahi mila.'
      });
    }

    // Defence in depth: even if a physical-inventory addon slipped
    // into the table (legacy data), refuse to attach it here.
    const addonCheck = await db.query(
      'SELECT is_physical_inventory FROM membership_addons WHERE id = $1 AND organization_id = $2',
      [targetAddonId, orgId]
    );
    if (addonCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Addon is organization ke andar nahi mila.' });
    }
    if (addonCheck.rows[0].is_physical_inventory) {
      return res.status(400).json({
        success: false,
        message: 'Ye physical-inventory addon hai (legacy record) — lockers module se allocate karein, is endpoint se nahi.'
      });
    }

    const query = `
      INSERT INTO member_membership_addons (
        membership_id, addon_id, quantity, price
      ) VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [targetMsId, targetAddonId, quantity, price]);
    return res.status(201).json({ success: true, message: 'Add-on attached to membership.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAddons = async (req, res) => {
  const orgId = req.user.orgId;
  try {
    const { rows } = await db.query(
      'SELECT * FROM membership_addons WHERE organization_id = $1 AND is_active = TRUE AND is_physical_inventory = FALSE ORDER BY id DESC',
      [orgId]
    );
    return res.status(200).json({ success: true, addons: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};