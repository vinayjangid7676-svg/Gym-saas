const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. GET ALL ROLES (System Roles + Gym-specific Custom Roles)
// ================================================================
exports.getRoles = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;

  try {
    const query = `
      SELECT 
        r.id, r.hash_id, r.name, r.slug, r.description, r.is_system_role,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS assigned_users_count,
        COALESCE((
          SELECT json_agg(json_build_object('id', p.id, 'module', p.module, 'action', p.action))
          FROM role_permissions rp
          JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = r.id
        ), '[]'::json) AS permissions
      FROM roles r
      WHERE (r.organization_id = $1 OR r.organization_id IS NULL)
      ORDER BY r.is_system_role DESC, r.id ASC;
    `;
    const { rows } = await db.query(query, [orgId]);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. GET ALL MASTER PERMISSIONS (Modules Matrix)
// ================================================================
exports.getPermissions = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, hash_id, module, action, description FROM permissions ORDER BY module ASC, action ASC'
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. CREATE CUSTOM ROLE WITH PERMISSIONS
// ================================================================
exports.createRole = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const { name, description, permission_ids = [] } = req.body;

  if (!name || !name.trim()) {
    client.release();
    return res.status(400).json({ success: false, message: 'Role ka name zaroori hai.' });
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

  try {
    await client.query('BEGIN');

    // Prevent duplicate role in organization
    const checkRes = await client.query(
      'SELECT id FROM roles WHERE (organization_id = $1 OR organization_id IS NULL) AND slug = $2',
      [orgId, slug]
    );
    if (checkRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: `Role '${name}' pehle se exist karta hai.` });
    }

    const hashId = generateHashId('rol_');
    const roleInsertQuery = `
      INSERT INTO roles (hash_id, organization_id, name, slug, description, is_system_role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), NOW())
      RETURNING *;
    `;
    const roleRes = await client.query(roleInsertQuery, [hashId, orgId, name.trim(), slug, description || null]);
    const newRole = roleRes.rows[0];

    // Assign permissions
    if (Array.isArray(permission_ids) && permission_ids.length > 0) {
      for (const pId of permission_ids) {
        if (!isNaN(parseInt(pId, 10))) {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newRole.id, parseInt(pId, 10)]
          );
        }
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Custom role created.', data: newRole });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. ASSIGN ROLE TO USER / STAFF (Update User's Active Role)
// ================================================================
exports.assignUserRole = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const { user_id, role_id } = req.body;

  if (!user_id || !role_id) {
    client.release();
    return res.status(400).json({ success: false, message: 'user_id aur role_id zaroori hain.' });
  }

  try {
    await client.query('BEGIN');

    // Verify user belongs to same tenant
    const userCheck = await client.query(
      'SELECT id, name FROM users WHERE id = $1 AND organization_id = $2',
      [parseInt(user_id, 10), orgId]
    );
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'User is gym ka nahi hai.' });
    }

    // Verify role belongs to tenant or is system role
    const roleCheck = await client.query(
      'SELECT id, name FROM roles WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)',
      [parseInt(role_id, 10), orgId]
    );
    if (roleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Role exist nahi karta.' });
    }

    // Replace user roles
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [parseInt(user_id, 10)]);
    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
      parseInt(user_id, 10),
      parseInt(role_id, 10)
    ]);

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `${userCheck.rows[0].name} ko role '${roleCheck.rows[0].name}' assign ho gaya.`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};