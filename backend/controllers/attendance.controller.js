const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. REGISTER ATTENDANCE DEVICE (Biometric / Turnstile / QR Scanner)
// ================================================================
exports.registerDevice = async (req, res) => {
  const orgId = req.user.orgId;
  const {
    branch_id,
    device_name,
    device_type, // 'biometric','rfid_turnstile','qr_scanner','face_recognition'
    serial_number,
    ip_address,
    direction = 'bidirectional'
  } = req.body;

  if (!branch_id || !device_name || !device_type || !serial_number) {
    return res.status(400).json({
      success: false,
      message: 'branch_id, device_name, device_type aur serial_number required hain.'
    });
  }

  try {
    // Generate device raw token and hash
    const rawApiToken = crypto.randomBytes(32).toString('hex');
    const apiTokenHash = crypto.createHash('sha256').update(rawApiToken).digest('hex');
    const hashId = generateHashId('dev_');

    const query = `
      INSERT INTO attendance_devices (
        hash_id, organization_id, branch_id, device_name,
        device_type, serial_number, ip_address, api_token_hash, direction, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'online')
      RETURNING id, hash_id, device_name, device_type, serial_number, status, created_at;
    `;

    const { rows } = await db.query(query, [
      hashId,
      orgId,
      branch_id,
      device_name,
      device_type,
      serial_number,
      ip_address || null,
      apiTokenHash,
      direction
    ]);

    return res.status(201).json({
      success: true,
      message: 'Device registered successfully.',
      device: rows[0],
      device_api_token: rawApiToken // Sirf ek baar dikhega machine me configure karne ke liye
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ye device serial number pehle se registered hai.' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. HARDWARE / SCANNER CHECK-IN (Public endpoint for Turnstiles)
// ================================================================
exports.processCheckIn = async (req, res) => {
  const {
    serial_number,
    identifier, // RFID string, Member Code, ya Barcode
    checkin_method // 'qr_dynamic','rfid','fingerprint','face','manual'
  } = req.body;

  if (!serial_number || !identifier || !checkin_method) {
    return res.status(400).json({
      success: false,
      message: 'serial_number, identifier aur checkin_method required hain.'
    });
  }

  try {
    // 1. Verify Device
    const devRes = await db.query(
      'SELECT id, organization_id, branch_id, status FROM attendance_devices WHERE serial_number = $1',
      [serial_number]
    );

    if (devRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unrecognized / Unauthorized Device.' });
    }

    const device = devRes.rows[0];

    // Update last_seen_at
    await db.query('UPDATE attendance_devices SET last_seen_at = NOW() WHERE id = $1', [device.id]);

    // 2. Identify Member
    const memberRes = await db.query(
      `SELECT id, hash_id, first_name, last_name, status 
       FROM members 
       WHERE organization_id = $1 
         AND (barcode_rfid = $2 OR member_code = $2)
         AND deleted_at IS NULL`,
      [device.organization_id, identifier]
    );

    const checkinHashId = generateHashId('att_');

    if (memberRes.rows.length === 0) {
      return res.status(404).json({
        access_granted: false,
        denial_reason: 'Member record not found'
      });
    }

    const member = memberRes.rows[0];

    // 3. Verify Active Membership
    const subRes = await db.query(
      `SELECT id, end_date, status 
       FROM memberships 
       WHERE member_id = $1 
         AND status = 'active' 
         AND end_date >= CURRENT_DATE 
       ORDER BY end_date DESC LIMIT 1`,
      [member.id]
    );

    let accessGranted = true;
    let denialReason = null;

    if (member.status !== 'active') {
      accessGranted = false;
      denialReason = `Member account is ${member.status}`;
    } else if (subRes.rows.length === 0) {
      accessGranted = false;
      denialReason = 'No active membership plan or expired';
    }

    // 4. Record Attendance Entry
    const logQuery = `
      INSERT INTO attendance (
        hash_id, organization_id, branch_id, member_id, device_id,
        check_in_time, checkin_method, access_granted, denial_reason
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
      RETURNING id, hash_id, check_in_time, access_granted, denial_reason;
    `;

    const { rows } = await db.query(logQuery, [
      checkinHashId,
      device.organization_id,
      device.branch_id,
      member.id,
      device.id,
      checkin_method,
      accessGranted,
      denialReason
    ]);

    return res.status(200).json({
      access_granted: accessGranted,
      denial_reason: denialReason,
      member: {
        name: `${member.first_name} ${member.last_name || ''}`.trim(),
        status: member.status
      },
      log: rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};