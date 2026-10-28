const fs = require('fs');
const path = require('path');
const pool = require('./config/db');


const runMigration = async () => {
  try {
    // schema.sql file ko read karna
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Migrating database tables...');
    
    // Database me query execute karna
    await pool.query(sql);
    
    console.log('✅ All tables created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
};

runMigration();