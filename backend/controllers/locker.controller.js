// const crypto = require('crypto');
// const db = require('../config/db');

// const generateHashId = (prefix = '') => {
//   const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
//   return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
// };

// /**
//  * Generates a reasonably-collision-safe invoice number and retries
//  * on the (rare) unique-constraint conflict. Real systems often use a
//  * per-org sequence table instead; this is adequate for launch scale
//  * and avoids adding another table/lock to this delivery.
//  */
// const generateInvoiceNumber = async (client, orgId) => {
//   const settingsRes = await client.query(
//     'SELECT invoice_prefix FROM organization_settings WHERE organization_id = $1',
//     [orgId]
//   );
//   const prefix = settingsRes.rows[0]?.invoice_prefix || 'INV';
//   const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
//   const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
//   return `${prefix}-${datePart}-${randomPart}`;
// };

// /**
//  * Resolves the price to charge for a locker at allocation time.
//  * Precedence: locker-level override -> branch default -> 0.
//  * Returns { monthlyRent, securityDeposit, source } so the caller can
//  * log/return where the number came from (useful for support tickets
//  * like "why was I charged X").
//  */
// const resolveLockerPricing = async (client, locker, orgId) => {
//   if (locker.monthly_rent !== null && locker.security_deposit !== null) {
//     return {
//       monthlyRent: Number(locker.monthly_rent),
//       securityDeposit: Number(locker.security_deposit),
//       source: 'locker_override'
//     };
//   }

//   const branchRes = await client.query(
//     `SELECT default_monthly_rent, default_security_deposit
//      FROM branch_locker_settings
//      WHERE branch_id = $1 AND organization_id = $2`,
//     [locker.branch_id, orgId]
//   );

//   if (branchRes.rows.length > 0) {
//     return {
//       monthlyRent: locker.monthly_rent !== null
//         ? Number(locker.monthly_rent)
//         : Number(branchRes.rows[0].default_monthly_rent),
//       securityDeposit: locker.security_deposit !== null
//         ? Number(locker.security_deposit)
//         : Number(branchRes.rows[0].default_security_deposit),
//       source: 'branch_default'
//     };
//   }

//   return { monthlyRent: 0, securityDeposit: 0, source: 'unconfigured' };
// };

// // ================================================================
// // 1. CREATE LOCKER (physical unit registration)
// // ================================================================
// exports.createLocker = async (req, res) => {
//   const orgId = req.user.orgId || req.user.org_id;
//   const { branch_id, locker_number, monthly_rent, security_deposit, locker_size, notes } = req.body;

//   if (!branch_id || !locker_number) {
//     return res.status(400).json({ success: false, message: 'branch_id aur locker_number required hain.' });
//   }

//   if (monthly_rent !== undefined && (isNaN(monthly_rent) || Number(monthly_rent) < 0)) {
//     return res.status(400).json({ success: false, message: 'monthly_rent valid non-negative number hona chahiye.' });
//   }
//   if (security_deposit !== undefined && (isNaN(security_deposit) || Number(security_deposit) < 0)) {
//     return res.status(400).json({ success: false, message: 'security_deposit valid non-negative number hona chahiye.' });
//   }

//   try {
//     // Confirm the branch actually belongs to this org before writing
//     // anything — prevents a malicious/buggy client from registering
//     // a locker against a branch_id belonging to another tenant.
//     const branchCheck = await db.query(
//       'SELECT id FROM branches WHERE id = $1 AND organization_id = $2',
//       [branch_id, orgId]
//     );
//     if (branchCheck.rows.length === 0) {
//       return res.status(404).json({ success: false, message: 'Branch is organization ke andar nahi mila.' });
//     }

//     const hashId = generateHashId('lok_');
//     const query = `
//       INSERT INTO lockers (
//         hash_id, organization_id, branch_id, locker_number, status,
//         monthly_rent, security_deposit, locker_size, notes
//       ) VALUES ($1, $2, $3, $4, 'available', $5, $6, $7, $8)
//       RETURNING *;
//     `;
//     const { rows } = await db.query(query, [
//       hashId,
//       orgId,
//       branch_id,
//       locker_number.trim(),
//       monthly_rent !== undefined ? Number(monthly_rent) : null,
//       security_deposit !== undefined ? Number(security_deposit) : null,
//       locker_size || null,
//       notes || null
//     ]);

//     return res.status(201).json({ success: true, message: 'Locker registered.', data: rows[0] });
//   } catch (error) {
//     if (error.code === '23505') {
//       return res.status(409).json({ success: false, message: 'Ye locker number is branch me pehle se exist karta hai.' });
//     }
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // ================================================================
// // 2. GET / SET branch-level default locker pricing
// // ================================================================
// exports.getBranchLockerPricing = async (req, res) => {
//   const orgId = req.user.orgId || req.user.org_id;
//   const { branch_id } = req.query;

//   if (!branch_id) {
//     return res.status(400).json({ success: false, message: 'branch_id query param required hai.' });
//   }

//   try {
//     const { rows } = await db.query(
//       `SELECT * FROM branch_locker_settings WHERE branch_id = $1 AND organization_id = $2`,
//       [branch_id, orgId]
//     );
//     return res.status(200).json({
//       success: true,
//       data: rows[0] || { branch_id: Number(branch_id), default_monthly_rent: 0, default_security_deposit: 0 }
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// exports.setBranchLockerPricing = async (req, res) => {
//   // NOTE: mount this route behind a role check (e.g. admin/owner only)
//   // in auth.middleware — pricing configuration should not be editable
//   // by front-desk staff roles. See routes file for the hook point.
//   const orgId = req.user.orgId || req.user.org_id;
//   const userId = req.user.userId || req.user.id;
//   const { branch_id, default_monthly_rent, default_security_deposit } = req.body;

//   if (!branch_id || default_monthly_rent === undefined || default_security_deposit === undefined) {
//     return res.status(400).json({
//       success: false,
//       message: 'branch_id, default_monthly_rent aur default_security_deposit required hain.'
//     });
//   }
//   if (isNaN(default_monthly_rent) || Number(default_monthly_rent) < 0) {
//     return res.status(400).json({ success: false, message: 'default_monthly_rent valid non-negative number hona chahiye.' });
//   }
//   if (isNaN(default_security_deposit) || Number(default_security_deposit) < 0) {
//     return res.status(400).json({ success: false, message: 'default_security_deposit valid non-negative number hona chahiye.' });
//   }

//   try {
//     const branchCheck = await db.query(
//       'SELECT id FROM branches WHERE id = $1 AND organization_id = $2',
//       [branch_id, orgId]
//     );
//     if (branchCheck.rows.length === 0) {
//       return res.status(404).json({ success: false, message: 'Branch nahi mila.' });
//     }

//     const hashId = generateHashId('bls_');
//     const query = `
//       INSERT INTO branch_locker_settings (
//         hash_id, organization_id, branch_id, default_monthly_rent, default_security_deposit, updated_by
//       ) VALUES ($1, $2, $3, $4, $5, $6)
//       ON CONFLICT (branch_id) DO UPDATE SET
//         default_monthly_rent = EXCLUDED.default_monthly_rent,
//         default_security_deposit = EXCLUDED.default_security_deposit,
//         updated_by = EXCLUDED.updated_by,
//         updated_at = NOW()
//       RETURNING *;
//     `;
//     const { rows } = await db.query(query, [
//       hashId, orgId, branch_id, Number(default_monthly_rent), Number(default_security_deposit), userId
//     ]);

//     return res.status(200).json({ success: true, message: 'Branch locker pricing updated.', data: rows[0] });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// // ================================================================
// // 3. ALLOCATE LOCKER TO MEMBER (creates invoice automatically)
// // ================================================================
// exports.allocateLocker = async (req, res) => {
//   const client = await db.connect();
//   const orgId = req.user.orgId || req.user.org_id;
//   const userId = req.user.userId || req.user.id;
//   const { locker_id, member_id, start_date, end_date } = req.body;

//   if (!locker_id || !member_id || !start_date) {
//     return res.status(400).json({ success: false, message: 'locker_id, member_id, aur start_date zaroori hain.' });
//   }

//   try {
//     await client.query('BEGIN');

//     // Lock the locker row for the duration of this transaction so a
//     // concurrent allocation request for the same locker has to wait
//     // (and will then correctly see status != 'available').
//     const lockerRes = await client.query(
//       'SELECT * FROM lockers WHERE id = $1 AND organization_id = $2 FOR UPDATE',
//       [locker_id, orgId]
//     );
//     if (lockerRes.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({ success: false, message: 'Locker nahi mila.' });
//     }
//     const locker = lockerRes.rows[0];

//     if (locker.status !== 'available') {
//       await client.query('ROLLBACK');
//       return res.status(400).json({ success: false, message: `Locker available nahi hai. Current status: ${locker.status}` });
//     }

//     // Member must belong to the same org — prevents allocating a
//     // locker to a member record from a different tenant.
//     const memberRes = await client.query(
//       'SELECT id, first_name, last_name FROM members WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
//       [member_id, orgId]
//     );
//     if (memberRes.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({ success: false, message: 'Member is organization ke andar nahi mila.' });
//     }

//     // ---- THE FIX: pricing comes from the server, never from req.body ----
//     const pricing = await resolveLockerPricing(client, locker, orgId);

//     if (pricing.source === 'unconfigured') {
//       await client.query('ROLLBACK');
//       return res.status(422).json({
//         success: false,
//         message: 'Is locker/branch ke liye pricing configure nahi hai. Pehle branch locker pricing set karein ya locker par override price daalein.'
//       });
//     }

//     const allocHashId = generateHashId('lka_');
//     const allocQuery = `
//       INSERT INTO locker_allocations (
//         hash_id, locker_id, member_id, organization_id, branch_id,
//         start_date, end_date, security_deposit, monthly_rent, status, created_by
//       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
//       RETURNING *;
//     `;
//     const allocRes = await client.query(allocQuery, [
//       allocHashId, locker.id, member_id, orgId, locker.branch_id,
//       start_date, end_date || null, pricing.securityDeposit, pricing.monthlyRent, userId
//     ]);
//     const allocation = allocRes.rows[0];

//     await client.query("UPDATE lockers SET status = 'occupied' WHERE id = $1", [locker.id]);

//     // ---- Auto-generate an invoice so this allocation has a real billing trail ----
//     let invoice = null;
//     const lineItems = [];
//     if (pricing.securityDeposit > 0) {
//       lineItems.push({
//         item_type: 'locker_security_deposit',
//         description: `Locker #${locker.locker_number} - Refundable Security Deposit`,
//         unit_price: pricing.securityDeposit
//       });
//     }
//     if (pricing.monthlyRent > 0) {
//       lineItems.push({
//         item_type: 'locker_rent',
//         description: `Locker #${locker.locker_number} - Monthly Rent`,
//         unit_price: pricing.monthlyRent
//       });
//     }

//     if (lineItems.length > 0) {
//       const subtotal = lineItems.reduce((sum, item) => sum + item.unit_price, 0);
//       const invoiceHashId = generateHashId('inv_');
//       let invoiceNumber;
//       let invoiceInsertRes;

//       // Retry once on invoice_number collision (extremely unlikely
//       // given the random suffix, but don't leave it unhandled).
//       for (let attempt = 0; attempt < 2; attempt += 1) {
//         invoiceNumber = await generateInvoiceNumber(client, orgId);
//         try {
//           invoiceInsertRes = await client.query(
//             `INSERT INTO invoices (
//                hash_id, organization_id, branch_id, member_id, invoice_number,
//                subtotal, discount_amount, tax_amount, total_amount, payment_status, due_date
//              ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $6, 'unpaid', $7)
//              RETURNING *;`,
//             [invoiceHashId, orgId, locker.branch_id, member_id, invoiceNumber, subtotal, start_date]
//           );
//           break;
//         } catch (err) {
//           if (err.code === '23505' && attempt === 0) continue; // retry once
//           throw err;
//         }
//       }

//       invoice = invoiceInsertRes.rows[0];

//       for (const item of lineItems) {
//         await client.query(
//           `INSERT INTO invoice_items (
//              invoice_id, item_type, reference_id, description, quantity, unit_price, total_price
//            ) VALUES ($1, $2, $3, $4, 1, $5, $5);`,
//           [invoice.id, item.item_type, allocation.id, item.description, item.unit_price]
//         );
//       }

//       await client.query(
//         'UPDATE locker_allocations SET invoice_id = $1 WHERE id = $2',
//         [invoice.id, allocation.id]
//       );
//       allocation.invoice_id = invoice.id;
//     }

//     await client.query('COMMIT');
//     return res.status(201).json({
//       success: true,
//       message: 'Locker allocated successfully.',
//       data: allocation,
//       pricing_source: pricing.source,
//       invoice
//     });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     return res.status(500).json({ success: false, error: error.message });
//   } finally {
//     client.release();
//   }
// };

// // ================================================================
// // 4. VACATE LOCKER  (SECURITY FIX: organization_id now enforced)
// // ================================================================
// exports.vacateLocker = async (req, res) => {
//   const client = await db.connect();
//   const orgId = req.user.orgId || req.user.org_id;
//   const userId = req.user.userId || req.user.id;
//   const { locker_id } = req.body;

//   if (!locker_id) {
//     client.release();
//     return res.status(400).json({ success: false, message: 'locker_id zaroori hai.' });
//   }

//   try {
//     await client.query('BEGIN');

//     // Lock + verify tenant ownership BEFORE touching anything. This
//     // single query is what was missing before and allowed any
//     // authenticated user to vacate any org's locker by guessing an id.
//     const lockerRes = await client.query(
//       'SELECT id, status FROM lockers WHERE id = $1 AND organization_id = $2 FOR UPDATE',
//       [locker_id, orgId]
//     );
//     if (lockerRes.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({ success: false, message: 'Locker nahi mila.' });
//     }

//     if (lockerRes.rows[0].status !== 'occupied') {
//       await client.query('ROLLBACK');
//       return res.status(400).json({ success: false, message: `Locker occupied nahi hai. Current status: ${lockerRes.rows[0].status}` });
//     }

//     const updateAllocRes = await client.query(
//       `UPDATE locker_allocations
//        SET status = 'completed', end_date = CURRENT_DATE, vacated_by = $3
//        WHERE locker_id = $1 AND organization_id = $2 AND status = 'active'
//        RETURNING *;`,
//       [locker_id, orgId, userId]
//     );

//     await client.query(
//       "UPDATE lockers SET status = 'available' WHERE id = $1 AND organization_id = $2",
//       [locker_id, orgId]
//     );

//     await client.query('COMMIT');
//     return res.status(200).json({
//       success: true,
//       message: 'Locker vacated and available again.',
//       data: updateAllocRes.rows[0] || null
//     });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     return res.status(500).json({ success: false, error: error.message });
//   } finally {
//     client.release();
//   }
// };

// // ================================================================
// // 5. GET All Lockers with Allocation + Pricing Details
// // ================================================================
// exports.getLockersList = async (req, res) => {
//   const orgId = req.user.orgId || req.user.org_id;
//   const { branch_id } = req.query;

//   try {
//     let query = `
//       SELECT
//         l.id, l.hash_id, l.locker_number, l.status, l.locker_size,
//         l.monthly_rent AS locker_monthly_rent_override,
//         l.security_deposit AS locker_security_deposit_override,
//         COALESCE(l.monthly_rent, bls.default_monthly_rent, 0) AS effective_monthly_rent,
//         COALESCE(l.security_deposit, bls.default_security_deposit, 0) AS effective_security_deposit,
//         (l.monthly_rent IS NULL AND bls.id IS NULL) AS pricing_unconfigured,
//         a.hash_id AS allocation_hash_id, a.member_id, a.start_date, a.end_date,
//         a.security_deposit AS charged_security_deposit,
//         a.monthly_rent AS charged_monthly_rent,
//         a.invoice_id,
//         m.first_name, m.last_name, m.member_code
//       FROM lockers l
//       LEFT JOIN branch_locker_settings bls
//         ON bls.branch_id = l.branch_id AND bls.organization_id = l.organization_id
//       LEFT JOIN locker_allocations a ON l.id = a.locker_id AND a.status = 'active'
//       LEFT JOIN members m ON a.member_id = m.id
//       WHERE l.organization_id = $1
//     `;
//     const params = [orgId];

//     if (branch_id) {
//       params.push(parseInt(branch_id, 10));
//       query += ` AND l.branch_id = $2`;
//     }

//     query += ` ORDER BY l.locker_number ASC;`;

//     const { rows } = await db.query(query, params);
//     return res.status(200).json({ success: true, data: rows });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };
const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. CREATE LOCKER (Physical Unit Registration)
// ================================================================
exports.createLocker = async (req, res) => {
  const orgId = req.user.orgId || req.user.org_id;
  const { branch_id, locker_number, monthly_rent, security_deposit, locker_size, notes } = req.body;

  if (!branch_id || !locker_number) {
    return res.status(400).json({ success: false, message: 'branch_id aur locker_number required hain.' });
  }

  if (monthly_rent !== undefined && (isNaN(monthly_rent) || Number(monthly_rent) < 0)) {
    return res.status(400).json({ success: false, message: 'monthly_rent valid non-negative number hona chahiye.' });
  }
  if (security_deposit !== undefined && (isNaN(security_deposit) || Number(security_deposit) < 0)) {
    return res.status(400).json({ success: false, message: 'security_deposit valid non-negative number hona chahiye.' });
  }

  try {
    const branchCheck = await db.query(
      'SELECT id FROM branches WHERE id = $1 AND organization_id = $2',
      [branch_id, orgId]
    );
    if (branchCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch is organization ke andar nahi mila.' });
    }

    const hashId = generateHashId('lok_');
    const query = `
      INSERT INTO lockers (
        hash_id, organization_id, branch_id, locker_number, status,
        monthly_rent, security_deposit, locker_size, notes
      ) VALUES ($1, $2, $3, $4, 'available', $5, $6, $7, $8)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId,
      orgId,
      branch_id,
      locker_number.trim(),
      monthly_rent !== undefined ? Number(monthly_rent) : null,
      security_deposit !== undefined ? Number(security_deposit) : null,
      locker_size || null,
      notes || null
    ]);

    return res.status(201).json({ success: true, message: 'Locker registered.', data: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ye locker number is branch me pehle se exist karta hai.' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. GET / SET BRANCH-LEVEL DEFAULT LOCKER PRICING
// ================================================================
exports.getBranchLockerPricing = async (req, res) => {
  const orgId = req.user.orgId || req.user.org_id;
  const { branch_id } = req.query;

  if (!branch_id) {
    return res.status(400).json({ success: false, message: 'branch_id query param required hai.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT * FROM branch_locker_settings WHERE branch_id = $1 AND organization_id = $2`,
      [branch_id, orgId]
    );
    return res.status(200).json({
      success: true,
      data: rows[0] || { branch_id: Number(branch_id), default_monthly_rent: 0, default_security_deposit: 0 }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.setBranchLockerPricing = async (req, res) => {
  const orgId = req.user.orgId || req.user.org_id;
  const userId = req.user.userId || req.user.id;
  const { branch_id, default_monthly_rent, default_security_deposit } = req.body;

  if (!branch_id || default_monthly_rent === undefined || default_security_deposit === undefined) {
    return res.status(400).json({
      success: false,
      message: 'branch_id, default_monthly_rent aur default_security_deposit required hain.'
    });
  }
  if (isNaN(default_monthly_rent) || Number(default_monthly_rent) < 0) {
    return res.status(400).json({ success: false, message: 'default_monthly_rent valid non-negative number hona chahiye.' });
  }
  if (isNaN(default_security_deposit) || Number(default_security_deposit) < 0) {
    return res.status(400).json({ success: false, message: 'default_security_deposit valid non-negative number hona chahiye.' });
  }

  try {
    const branchCheck = await db.query(
      'SELECT id FROM branches WHERE id = $1 AND organization_id = $2',
      [branch_id, orgId]
    );
    if (branchCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch nahi mila.' });
    }

    const hashId = generateHashId('bls_');
    const query = `
      INSERT INTO branch_locker_settings (
        hash_id, organization_id, branch_id, default_monthly_rent, default_security_deposit, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (branch_id) DO UPDATE SET
        default_monthly_rent = EXCLUDED.default_monthly_rent,
        default_security_deposit = EXCLUDED.default_security_deposit,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, orgId, branch_id, Number(default_monthly_rent), Number(default_security_deposit), userId
    ]);

    return res.status(200).json({ success: true, message: 'Branch locker pricing updated.', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. VACATE LOCKER (Multi-tenant & Concurrency Safe)
// ================================================================
exports.vacateLocker = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId || req.user.org_id;
  const userId = req.user.userId || req.user.id;
  const { locker_id } = req.body;

  if (!locker_id) {
    client.release();
    return res.status(400).json({ success: false, message: 'locker_id zaroori hai.' });
  }

  try {
    await client.query('BEGIN');

    const lockerRes = await client.query(
      'SELECT id, status FROM lockers WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [locker_id, orgId]
    );
    if (lockerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Locker nahi mila.' });
    }

    if (lockerRes.rows[0].status !== 'occupied') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Locker occupied nahi hai. Current status: ${lockerRes.rows[0].status}` });
    }

    const updateAllocRes = await client.query(
      `UPDATE locker_allocations
       SET status = 'completed', end_date = CURRENT_DATE, vacated_by = $3
       WHERE locker_id = $1 AND organization_id = $2 AND status = 'active'
       RETURNING *;`,
      [locker_id, orgId, userId]
    );

    await client.query(
      "UPDATE lockers SET status = 'available' WHERE id = $1 AND organization_id = $2",
      [locker_id, orgId]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Locker vacated and marked available again.',
      data: updateAllocRes.rows[0] || null
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. GET ALL LOCKERS WITH ALLOCATION & PRICING
// ================================================================
exports.getLockersList = async (req, res) => {
  const orgId = req.user.orgId || req.user.org_id;
  const { branch_id } = req.query;

  try {
    let query = `
      SELECT
        l.id, l.hash_id, l.locker_number, l.status, l.locker_size,
        l.monthly_rent AS locker_monthly_rent_override,
        l.security_deposit AS locker_security_deposit_override,
        COALESCE(l.monthly_rent, bls.default_monthly_rent, 0) AS effective_monthly_rent,
        COALESCE(l.security_deposit, bls.default_security_deposit, 0) AS effective_security_deposit,
        (l.monthly_rent IS NULL AND bls.id IS NULL) AS pricing_unconfigured,
        a.hash_id AS allocation_hash_id, a.member_id, a.start_date, a.end_date,
        a.security_deposit AS charged_security_deposit,
        a.monthly_rent AS charged_monthly_rent,
        a.invoice_id,
        inv.invoice_number,
        inv.payment_status as invoice_payment_status,
        m.first_name, m.last_name, m.member_code
      FROM lockers l
      LEFT JOIN branch_locker_settings bls
        ON bls.branch_id = l.branch_id AND bls.organization_id = l.organization_id
      LEFT JOIN locker_allocations a ON l.id = a.locker_id AND a.status = 'active'
      LEFT JOIN invoices inv ON inv.id = a.invoice_id
      LEFT JOIN members m ON a.member_id = m.id
      WHERE l.organization_id = $1
    `;
    const params = [orgId];

    if (branch_id) {
      params.push(parseInt(branch_id, 10));
      query += ` AND l.branch_id = $2`;
    }

    query += ` ORDER BY l.locker_number ASC;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};