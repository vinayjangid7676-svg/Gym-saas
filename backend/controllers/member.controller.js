const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. CREATE MEMBER (Multer File Upload + Auto-Branch Resolution)
// ================================================================
exports.createMember = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const userId = req.user.userId;

  let {
    primary_branch_id,
    member_code,
    first_name,
    middle_name,
    last_name,
    phone,
    alternate_phone,
    email,
    gender,
    date_of_birth,
    blood_group,
    marital_status,
    barcode_rfid,
    join_date,
    referral_member_id,
    lead_source,
    whatsapp_opt_in = true,
    sms_opt_in = true,
    email_opt_in = true,
    notes,
    address,
    emergency_contact
  } = req.body;

  let profile_image_url = null;
  if (req.file) {
    profile_image_url = `/uploads/members/${req.file.filename}`;
  } else if (req.body.profile_image_url) {
    profile_image_url = req.body.profile_image_url;
  }

  if (typeof address === 'string') {
    try { address = JSON.parse(address); } catch (e) { address = null; }
  }
  if (typeof emergency_contact === 'string') {
    try { emergency_contact = JSON.parse(emergency_contact); } catch (e) { emergency_contact = null; }
  }

  const isWhatsappOpt = String(whatsapp_opt_in) === 'true';
  const isSmsOpt = String(sms_opt_in) === 'true';
  const isEmailOpt = String(email_opt_in) === 'true';

  try {
    await client.query('BEGIN');

    // 1. AUTO-BRANCH RESOLUTION
    if (!primary_branch_id) {
      primary_branch_id = req.branchId || req.headers['x-branch-id'];
    }

    if (!primary_branch_id) {
      const defaultBranchRes = await client.query(
        `SELECT id FROM branches WHERE organization_id = $1 AND deleted_at IS NULL AND is_active = TRUE ORDER BY id ASC LIMIT 1`,
        [orgId]
      );
      if (defaultBranchRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Is gym organization ki koi active branch nahi mili. Pehle branch configure karein.'
        });
      }
      primary_branch_id = defaultBranchRes.rows[0].id;
    } else {
      const branchCheck = await client.query(
        'SELECT id FROM branches WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
        [primary_branch_id, orgId]
      );
      if (branchCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Invalid primary_branch_id for this organization.' });
      }
    }

    // 2. AUTO-GENERATE MEMBER CODE
    if (!member_code || !member_code.trim()) {
      const codeSeq = await client.query(
        `SELECT COUNT(*) + 1 AS next_code FROM members WHERE organization_id = $1`,
        [orgId]
      );
      const prefixRes = await client.query(
        `SELECT member_code_prefix FROM organization_settings WHERE organization_id = $1`,
        [orgId]
      );
      const prefix = prefixRes.rows[0]?.member_code_prefix || 'MEM';
      const seqNumber = String(codeSeq.rows[0].next_code).padStart(4, '0');
      member_code = `${prefix}-${seqNumber}`;
    }

    if (!first_name || !phone) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'First Name aur Phone number mandatory fields hain.'
      });
    }

    const effectiveJoinDate = join_date || new Date().toISOString().split('T')[0];
    const memberHashId = generateHashId('mbr_');

    const memberInsertQuery = `
      INSERT INTO members (
        hash_id, organization_id, primary_branch_id, member_code,
        first_name, middle_name, last_name, phone, alternate_phone, email,
        gender, date_of_birth, blood_group, marital_status,
        profile_image_url, barcode_rfid, status, join_date,
        referral_member_id, lead_source, whatsapp_opt_in, sms_opt_in,
        email_opt_in, notes, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, 'active', $17,
        $18, $19, $20, $21,
        $22, $23, $24, $24
      )
      RETURNING id, hash_id, member_code, first_name, last_name, phone, email, status, join_date, profile_image_url, created_at;
    `;

    const memberValues = [
      memberHashId,
      orgId,
      primary_branch_id,
      member_code.trim(),
      first_name.trim(),
      middle_name ? middle_name.trim() : null,
      last_name ? last_name.trim() : null,
      phone.trim(),
      alternate_phone ? alternate_phone.trim() : null,
      email ? email.trim().toLowerCase() : null,
      gender || null,
      date_of_birth || null,
      blood_group || null,
      marital_status || null,
      profile_image_url,
      barcode_rfid ? barcode_rfid.trim() : null,
      effectiveJoinDate,
      referral_member_id || null,
      lead_source || null,
      isWhatsappOpt,
      isSmsOpt,
      isEmailOpt,
      notes || null,
      userId
    ];

    const memberResult = await client.query(memberInsertQuery, memberValues);
    const newMember = memberResult.rows[0];

    // Optional: Address
    if (address && address.address_line1) {
      const addrHashId = generateHashId('adr_');
      await client.query(`
        INSERT INTO member_addresses (
          hash_id, member_id, address_type, address_line1, address_line2,
          city, state, country, postal_code, is_primary
        ) VALUES ($1, $2, 'home', $3, $4, $5, $6, $7, $8, TRUE);
      `, [
        addrHashId,
        newMember.id,
        address.address_line1,
        address.address_line2 || null,
        address.city || null,
        address.state || null,
        address.country || 'India',
        address.postal_code || null
      ]);
    }

    // Optional: Emergency Contact
    if (emergency_contact && emergency_contact.name && emergency_contact.phone) {
      const emgHashId = generateHashId('emg_');
      await client.query(`
        INSERT INTO member_emergency_contacts (
          hash_id, member_id, name, relationship, phone, alternate_phone, email, is_primary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE);
      `, [
        emgHashId,
        newMember.id,
        emergency_contact.name,
        emergency_contact.relationship || null,
        emergency_contact.phone,
        emergency_contact.alternate_phone || null,
        emergency_contact.email || null
      ]);
    }

    // Default Notification Preferences
    await client.query(
      `INSERT INTO notification_preferences (
        member_id, membership_expiry, payment_reminder, birthday,
        attendance, promotions, whatsapp, sms, email
      ) VALUES ($1, TRUE, TRUE, TRUE, TRUE, TRUE, $2, $3, $4)
      ON CONFLICT (member_id) DO NOTHING;`,
      [newMember.id, isWhatsappOpt, isSmsOpt, isEmailOpt]
    );

    // Audit Log
    const auditHashId = generateHashId('adt_');
    await client.query(
      `INSERT INTO audit_logs (
        hash_id, organization_id, user_id, branch_id,
        action, entity_type, entity_id, new_data
      ) VALUES ($1, $2, $3, $4, 'CREATE', 'members', $5, $6);`,
      [
        auditHashId,
        orgId,
        userId,
        primary_branch_id,
        newMember.id,
        JSON.stringify({ member_code: newMember.member_code, name: newMember.first_name, photo: profile_image_url })
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Member successfully create ho gaya.',
      data: newMember
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505' && error.constraint === 'uq_org_member_code') {
      return res.status(409).json({ success: false, message: 'Member code is organization me pehle se exist karta hai.' });
    }
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 2. GET ALL MEMBERS (Strict Branch Isolation & Scoping)
// ================================================================
exports.getMembers = async (req, res) => {
  const orgId = req.user.orgId;
  const { status, search, page = 1, limit = 20, all_branches } = req.query;
  const branchId = req.query.branch_id || req.branchId || req.headers['x-branch-id'];

  const parsedLimit = parseInt(limit, 10);
  const offset = (parseInt(page, 10) - 1) * parsedLimit;

  try {
    let baseQuery = `
      SELECT 
        m.id,
        m.hash_id,
        m.member_code,
        m.first_name,
        m.middle_name,
        m.last_name,
        m.phone,
        m.email,
        m.gender,
        m.status,
        m.join_date,
        m.barcode_rfid,
        m.profile_image_url,
        m.primary_branch_id,
        b.id as branch_id,
        b.name as branch_name,
        b.code as branch_code
      FROM members m
      JOIN branches b ON m.primary_branch_id = b.id
      WHERE m.organization_id = $1 AND m.deleted_at IS NULL
    `;

    const queryParams = [orgId];

    if (all_branches !== 'true' && branchId) {
      queryParams.push(parseInt(branchId, 10));
      baseQuery += ` AND m.primary_branch_id = $${queryParams.length}`;
    }

    if (status) {
      queryParams.push(status);
      baseQuery += ` AND m.status = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      baseQuery += ` AND (
        m.first_name ILIKE $${pIdx} OR 
        m.last_name ILIKE $${pIdx} OR 
        m.phone ILIKE $${pIdx} OR 
        m.member_code ILIKE $${pIdx} OR 
        m.barcode_rfid ILIKE $${pIdx}
      )`;
    }

    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) AS count_tbl;`;
    const countRes = await db.query(countQuery, queryParams);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    baseQuery += ` ORDER BY m.id DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(parsedLimit, offset);

    const { rows } = await db.query(baseQuery, queryParams);

    return res.status(200).json({
      success: true,
      page: parseInt(page, 10),
      limit: parsedLimit,
      count: totalCount,
      data: rows
    });
  } catch (error) {
    console.error('getMembers branch scoping error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. GET SINGLE MEMBER 360° (WITH ACTIVE LOCKER DETAILS & INVOICE)
// ================================================================
exports.getMemberByHashId = async (req, res) => {
  const orgId = req.user.orgId;
  const { hash_id } = req.params;

  try {
    const memberQuery = `
      SELECT 
        m.id, m.hash_id, m.member_code, m.first_name, m.middle_name, m.last_name,
        m.phone, m.alternate_phone, m.email, m.gender, m.date_of_birth, m.blood_group,
        m.marital_status, m.profile_image_url, m.barcode_rfid, m.status, m.join_date,
        m.lead_source, m.notes, m.created_at,
        b.id as branch_id, b.name as branch_name, b.code as branch_code
      FROM members m
      JOIN branches b ON m.primary_branch_id = b.id
      WHERE m.hash_id = $1 AND m.organization_id = $2 AND m.deleted_at IS NULL;
    `;
    const { rows } = await db.query(memberQuery, [hash_id, orgId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const member = rows[0];

    // Membership details
    const membershipQuery = `
      SELECT ms.id, ms.hash_id, ms.start_date, ms.end_date, ms.status, ms.total_amount, ms.paid_amount, ms.due_amount,
             mp.name as plan_name
      FROM memberships ms
      JOIN membership_plans mp ON ms.plan_id = mp.id
      WHERE ms.member_id = $1 AND ms.status = 'active'
      ORDER BY ms.id DESC LIMIT 1;
    `;
    const membershipRes = await db.query(membershipQuery, [member.id]);

    // Active Locker details with invoice linkage
    const lockerQuery = `
      SELECT 
        la.id,
        la.hash_id,
        la.locker_id,
        la.start_date,
        la.end_date,
        la.security_deposit,
        la.monthly_rent,
        la.status,
        la.invoice_id,
        l.locker_number,
        l.status as locker_physical_status,
        inv.invoice_number,
        inv.payment_status as invoice_payment_status
      FROM locker_allocations la
      JOIN lockers l ON l.id = la.locker_id
      LEFT JOIN invoices inv ON inv.id = la.invoice_id
      WHERE la.member_id = $1 AND la.organization_id = $2 AND la.status = 'active'
      ORDER BY la.id DESC;
    `;
    const lockerRes = await db.query(lockerQuery, [member.id, orgId]);

    // Invoices list
    const invoicesQuery = `
      SELECT i.id, i.hash_id, i.invoice_number, i.total_amount, i.payment_status, i.created_at,
             COALESCE((SELECT SUM(allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0) as paid_amount,
             GREATEST(0, i.total_amount - COALESCE((SELECT SUM(allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0)) as due_amount
      FROM invoices i
      WHERE i.member_id = $1 AND i.organization_id = $2
      ORDER BY i.id DESC LIMIT 15;
    `;
    const invoicesRes = await db.query(invoicesQuery, [member.id, orgId]);

    const addressRes = await db.query('SELECT * FROM member_addresses WHERE member_id = $1', [member.id]);
    const emergencyRes = await db.query('SELECT * FROM member_emergency_contacts WHERE member_id = $1', [member.id]);

    return res.status(200).json({
      success: true,
      data: {
        ...member,
        active_membership: membershipRes.rows[0] || null,
        lockers: lockerRes.rows || [],
        invoices: invoicesRes.rows || [],
        addresses: addressRes.rows,
        emergency_contacts: emergencyRes.rows
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. DIRECT MEMBER PROFILE PHOTO UPDATE / UPLOAD
// ================================================================
exports.uploadMemberPhoto = async (req, res) => {
  const orgId = req.user.orgId;
  const { hash_id } = req.params;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Kripya photo select karein.' });
  }

  const profile_image_url = `/uploads/members/${req.file.filename}`;

  try {
    const { rows } = await db.query(
      `UPDATE members 
       SET profile_image_url = $1, updated_at = NOW() 
       WHERE hash_id = $2 AND organization_id = $3 AND deleted_at IS NULL
       RETURNING id, hash_id, profile_image_url;`,
      [profile_image_url, hash_id, orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member record nahi mila.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile photo successfully upload ho gayi!',
      profile_image_url
    });
  } catch (error) {
    console.error('Error updating member photo:', error);
    return res.status(500).json({ success: false, message: 'Photo upload fail hua.', error: error.message });
  }
};