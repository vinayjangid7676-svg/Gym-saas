const db = require('../config/db');

// 1. Get Lockers for POS
exports.getLockers = async (req, res) => {
  try {
    const orgId = req.user.orgId || req.user.org_id;
    const { branch_id } = req.query;
    
    let query = `SELECT * FROM lockers WHERE organization_id = $1 AND status = 'available'`;
    let params = [orgId];
    
    if (branch_id) {
      params.push(parseInt(branch_id, 10));
      query += ` AND branch_id = $2`;
    }
    
    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Get PT (Personal Training) Plans
exports.getPtPlans = async (req, res) => {
  try {
    const orgId = req.user.orgId || req.user.org_id;
    const { rows } = await db.query(
      `SELECT * FROM personal_training_plans WHERE organization_id = $1 AND is_active = TRUE`,
      [orgId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Get Membership Add-ons
exports.getAddons = async (req, res) => {
  try {
    const orgId = req.user.orgId || req.user.org_id;
    const { rows } = await db.query(
      `SELECT * FROM membership_addons WHERE organization_id = $1 AND is_active = TRUE`,
      [orgId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};