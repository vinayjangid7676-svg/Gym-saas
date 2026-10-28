const db = require('../config/db');

module.exports = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const { rows } = await db.query(
      'SELECT is_super_admin, status FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0 || !rows[0].is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Yeh action perform karne ke liye Super Admin permissions zaroori hain.'
      });
    }

    if (rows[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Aapka Super Admin account active status me nahi hai.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};