const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. API KEYS (Machine-to-Machine / IoT Hardware Auth)
// ================================================================

exports.generateApiKey = async (req, res) => {
  const orgId = req.user.orgId;
  const userId = req.user.userId;
  const { name, expires_in_days = 365 } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'API key ka name required hai.' });
  }

  try {
    const rawKey = `gym_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const hashId = generateHashId('apk_');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days, 10));

    const query = `
      INSERT INTO api_keys (
        hash_id, organization_id, name, key_hash, expires_at, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, TRUE, $6)
      RETURNING id, hash_id, name, expires_at, is_active, created_at;
    `;
    const { rows } = await db.query(query, [hashId, orgId, name.trim(), keyHash, expiresAt, userId]);

    return res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Ise safe jagah save karein, yeh dobara nahi dikhegi.',
      api_key: rawKey,
      key_details: rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. AUDIT LOGS & WEBHOOK LOGS
// ================================================================

// Record System Audit Log
exports.recordAuditLog = async (req, res) => {
  const orgId = req.user.orgId;
  const userId = req.user.userId;
  const { branch_id, action, entity_type, entity_id, old_data, new_data } = req.body;

  if (!action || !entity_type) {
    return res.status(400).json({ success: false, message: 'action aur entity_type required hain.' });
  }

  try {
    const hashId = generateHashId('aud_');
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || null;

    const query = `
      INSERT INTO audit_logs (
        hash_id, organization_id, user_id, branch_id, action, entity_type,
        entity_id, old_data, new_data, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, orgId, userId, branch_id || null, action, entity_type,
      entity_id || null, old_data ? JSON.stringify(old_data) : null,
      new_data ? JSON.stringify(new_data) : null, ipAddress, userAgent
    ]);

    return res.status(201).json({ success: true, message: 'Audit log recorded.', log: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Ingest External Webhooks (Razorpay, Stripe, WhatsApp Gateway)
exports.handleWebhook = async (req, res) => {
  const { provider, event_type, external_event_id, payload } = req.body;
  const orgId = req.body.organization_id || null;

  if (!provider || !event_type || !payload) {
    return res.status(400).json({ success: false, message: 'provider, event_type aur payload required hain.' });
  }

  try {
    const hashId = generateHashId('whk_');
    const query = `
      INSERT INTO webhook_logs (
        hash_id, organization_id, provider, event_type, external_event_id,
        payload, response_code, processed, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 200, TRUE, NOW())
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, orgId, provider, event_type, external_event_id || null, JSON.stringify(payload)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Webhook received and processed.',
      log: rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Record Database Backup Entry
exports.logBackup = async (req, res) => {
  const orgId = req.user.orgId;
  const { backup_type = 'full', storage_provider = 's3', storage_path, file_size_bytes, checksum } = req.body;

  try {
    const hashId = generateHashId('bak_');
    const query = `
      INSERT INTO backup_logs (
        hash_id, organization_id, backup_type, storage_provider, storage_path,
        started_at, completed_at, status, file_size_bytes, checksum
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 'completed', $6, $7)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, orgId, backup_type, storage_provider, storage_path || null, file_size_bytes || null, checksum || null
    ]);

    return res.status(201).json({ success: true, message: 'Backup entry logged.', backup: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. SYSTEM CONFIGURATION (Section 20)
// ================================================================

// Get or Update Organization Settings
exports.saveOrgSettings = async (req, res) => {
  const orgId = req.user.orgId;
  const {
    currency = 'INR',
    timezone = 'Asia/Kolkata',
    date_format = 'DD-MM-YYYY',
    invoice_prefix = 'INV',
    member_code_prefix = 'MEM',
    tax_enabled = false,
    settings = {}
  } = req.body;

  try {
    const query = `
      INSERT INTO organization_settings (
        organization_id, currency, timezone, date_format,
        invoice_prefix, member_code_prefix, tax_enabled, settings, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (organization_id) DO UPDATE SET
        currency = EXCLUDED.currency,
        timezone = EXCLUDED.timezone,
        date_format = EXCLUDED.date_format,
        invoice_prefix = EXCLUDED.invoice_prefix,
        member_code_prefix = EXCLUDED.member_code_prefix,
        tax_enabled = EXCLUDED.tax_enabled,
        settings = EXCLUDED.settings,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      orgId, currency, timezone, date_format, invoice_prefix,
      member_code_prefix, tax_enabled, JSON.stringify(settings)
    ];

    const { rows } = await db.query(query, values);
    return res.status(200).json({
      success: true,
      message: 'Organization configuration updated successfully.',
      settings: rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Save Branch Settings
exports.saveBranchSettings = async (req, res) => {
  const { branch_id, settings = {} } = req.body;

  if (!branch_id) {
    return res.status(400).json({ success: false, message: 'branch_id required hai.' });
  }

  try {
    const query = `
      INSERT INTO branch_settings (branch_id, settings, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (branch_id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = NOW()
      RETURNING *;
    `;
    const { rows } = await db.query(query, [branch_id, JSON.stringify(settings)]);
    return res.status(200).json({
      success: true,
      message: 'Branch settings saved.',
      branch_settings: rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get All Settings
exports.getConfig = async (req, res) => {
  const orgId = req.user.orgId;

  try {
    const orgSettingsRes = await db.query(
      'SELECT * FROM organization_settings WHERE organization_id = $1',
      [orgId]
    );

    const branchSettingsRes = await db.query(
      `SELECT bs.*, b.name AS branch_name, b.code 
       FROM branch_settings bs
       JOIN branches b ON bs.branch_id = b.id
       WHERE b.organization_id = $1`,
      [orgId]
    );

    return res.status(200).json({
      success: true,
      organization_settings: orgSettingsRes.rows[0] || null,
      branch_settings: branchSettingsRes.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};