const bcrypt = require('bcrypt');
const db = require('./config/db'); // Aapka existing DB connection

async function resetSuperAdminPassword() {
  const targetEmailOrPhone = 'admin@gymsaas.com'; // Apna Email/Phone dalein
  const newPlainPassword = 'adminora@123456'; // Naya Password dalein

  try {
    // 1. Naya Bcrypt Hash generate karein
    const saltRounds = 10;
    const newHash = await bcrypt.hash(newPlainPassword, saltRounds);

    // 2. Database update query
    const query = `
      UPDATE users 
      SET password_hash = $1, 
          status = 'active', 
          is_super_admin = true,
          updated_at = NOW() 
      WHERE (LOWER(email) = LOWER($2) OR phone = $2) 
        AND deleted_at IS NULL
      RETURNING id, name, email, is_super_admin;
    `;

    const res = await db.query(query, [newHash, targetEmailOrPhone]);

    if (res.rows.length > 0) {
      console.log('✅ Password successfully reset ho gaya!');
      console.log('User Details:', res.rows[0]);
    } else {
      console.log('❌ User nahi mila! Please email/phone verify karein.');
    }
  } catch (err) {
    console.error('❌ Error during reset:', err);
  } process.exit();
}

resetSuperAdminPassword();