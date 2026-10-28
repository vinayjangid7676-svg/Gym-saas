const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// Generates Sequential Financial Numbers like REC-2026-00001
const getNextReceiptNumber = async (client, orgId, branchId) => {
  const currentYear = new Date().getFullYear().toString();
  const res = await client.query(
    `INSERT INTO receipt_sequences (organization_id, branch_id, fiscal_year, current_counter, updated_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (organization_id, branch_id, fiscal_year)
     DO UPDATE SET current_counter = receipt_sequences.current_counter + 1, updated_at = NOW()
     RETURNING current_counter;`,
    [orgId, branchId, currentYear]
  );
  const count = res.rows[0].current_counter;
  return `REC-${currentYear}-${String(count).padStart(5, '0')}`;
};

// ================================================================
// 1. CREATE INVOICE (With Memberships, Products, Studio Classes, & Lockers)
// ================================================================
exports.createInvoice = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const userId = req.user?.userId || req.user?.id;
  const {
    branch_id,
    member_id,
    invoice_number,
    subtotal,
    discount_amount = 0.00,
    tax_amount = 0.00,
    round_off_amount = 0.00,
    total_amount,
    due_date,
    notes,
    items,
    initial_payment,
    coupon_code
  } = req.body;

  const finalBranchId = branch_id ? parseInt(branch_id, 10) : (req.user?.branch_id || req.user?.branchId);

  if (!finalBranchId || !member_id || !invoice_number || total_amount === undefined || !items || !items.length) {
    client.release();
    return res.status(400).json({
      success: false,
      message: 'branch_id, member_id, invoice_number, total_amount aur items zaroori hain.'
    });
  }

  const parsedMemberId = parseInt(member_id, 10);

  try {
    await client.query('BEGIN');

    // 1. Verify Member
    const memberCheck = await client.query(
      'SELECT id, first_name, last_name, phone FROM members WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [parsedMemberId, orgId]
    );
    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Member exist nahi karta is gym me.' });
    }

    // 2. Inventory & Product Stock Validation
    for (const item of items) {
      if (item.item_type === 'product' && item.reference_id) {
        const prodId = parseInt(item.reference_id, 10);
        const reqQty = parseFloat(item.quantity || 1);
        const stockRes = await client.query(
          `SELECT COALESCE((
            SELECT SUM(CASE WHEN LOWER(movement_type) IN ('purchase_in', 'adjustment_add', 'return_in', 'inward', 'opening_stock') THEN quantity ELSE -quantity END)
            FROM stock_movements
            WHERE product_id = $3 AND organization_id = $1 AND ($2::BIGINT IS NULL OR branch_id = $2 OR branch_id IS NULL)
          ), 0)::FLOAT AS current_stock`,
          [orgId, finalBranchId, prodId]
        );
        if (parseFloat(stockRes.rows[0].current_stock) < reqQty) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Stock insufficient for item "${item.description || 'Product'}".`
          });
        }
      }
    }

    // 3. Coupon Verification
    let appliedCoupon = null;
    let computedCouponDiscount = 0.00;
    if (coupon_code) {
      const cpnRes = await client.query(
        `SELECT c.*, o.discount_type, o.discount_value
         FROM coupons c
         LEFT JOIN offers o ON c.offer_id = o.id
         WHERE c.organization_id = $1 AND c.code = $2 AND c.is_active = TRUE FOR UPDATE OF c;`,
        [orgId, String(coupon_code).trim().toUpperCase()]
      );
      if (cpnRes.rows.length > 0) {
        appliedCoupon = cpnRes.rows[0];
        const numSubtotal = parseFloat(subtotal || total_amount);
        computedCouponDiscount = appliedCoupon.discount_type === 'percentage'
          ? (numSubtotal * parseFloat(appliedCoupon.discount_value)) / 100
          : parseFloat(appliedCoupon.discount_value || 0);
        computedCouponDiscount = Math.min(computedCouponDiscount, numSubtotal);
      }
    }

    // 4. Financial Calculations
    const paidAmt = initial_payment && initial_payment.amount ? parseFloat(initial_payment.amount) : 0;
    const finalTotal = parseFloat(total_amount);
    let paymentStatus = 'unpaid';
    if (paidAmt >= (finalTotal - 0.01)) {
      paymentStatus = 'paid';
    } else if (paidAmt > 0) {
      paymentStatus = 'partially_paid';
    }

    const totalTaxVal = parseFloat(tax_amount || 0);
    const cgstVal = totalTaxVal / 2;
    const sgstVal = totalTaxVal / 2;

    // 5. Create Master Invoice
    const invoiceHashId = generateHashId('inv_');
    const invoiceQuery = `
      INSERT INTO invoices (
        hash_id, organization_id, branch_id, member_id, invoice_number,
        subtotal, discount_amount, tax_amount, cgst_amount, sgst_amount, igst_amount,
        round_off_amount, total_amount, payment_status, due_date, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *;
    `;
    const invoiceRes = await client.query(invoiceQuery, [
      invoiceHashId,
      orgId,
      finalBranchId,
      parsedMemberId,
      invoice_number.trim(),
      parseFloat(subtotal || total_amount),
      parseFloat(discount_amount || 0.00),
      totalTaxVal,
      cgstVal,
      sgstVal,
      parseFloat(round_off_amount || 0.00),
      finalTotal,
      paymentStatus,
      due_date || null,
      notes || null
    ]);
    const invoice = invoiceRes.rows[0];

    // 6. Record Coupon Usage
    if (appliedCoupon) {
      await client.query(
        `INSERT INTO coupon_usages (coupon_id, member_id, invoice_id, discount_amount, used_at)
         VALUES ($1, $2, $3, $4, NOW());`,
        [appliedCoupon.id, parsedMemberId, invoice.id, computedCouponDiscount]
      );
      await client.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [appliedCoupon.id]);
    }

    // 7. Line Items & Services Activation
    const createdMemberships = [];
    const createdClassBookings = [];
    const createdLockerAllocations = [];

    for (const item of items) {
      const lineQty = parseFloat(item.quantity || 1);
      const lineUnitPrice = parseFloat(item.unit_price || 0);
      const lineTax = parseFloat(item.tax_amount || 0);
      const lineDisc = parseFloat(item.discount_amount || 0);
      const lineTotal = parseFloat(item.total_price || (lineQty * lineUnitPrice));

      const itemRes = await client.query(
        `INSERT INTO invoice_items (
          invoice_id, item_type, reference_id, description,
          quantity, unit_price, discount_amount, tax_amount, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id;`,
        [
          invoice.id,
          item.item_type || 'membership',
          item.reference_id ? parseInt(item.reference_id, 10) : null,
          item.description,
          lineQty,
          lineUnitPrice,
          lineDisc,
          lineTax,
          lineTotal
        ]
      );
      const invoiceItemId = itemRes.rows[0].id;

      // 7A. Memberships activation
      if (item.item_type === 'membership' && item.reference_id) {
        const planId = parseInt(item.reference_id, 10);
        const planRes = await client.query(
          'SELECT id, duration_days FROM membership_plans WHERE id = $1 AND organization_id = $2',
          [planId, orgId]
        );
        if (planRes.rows.length > 0) {
          const plan = planRes.rows[0];
          const startDateStr = item.start_date || new Date().toISOString().split('T')[0];
          const startObj = new Date(startDateStr);
          const endObj = new Date(startObj);
          endObj.setDate(startObj.getDate() + Number(plan.duration_days));
          const endDateStr = endObj.toISOString().split('T')[0];

          const itemPaidShare = finalTotal > 0 ? (lineTotal / finalTotal) * paidAmt : 0;
          const msHashId = generateHashId('msp_');
          const msRes = await client.query(
            `INSERT INTO memberships (
              hash_id, organization_id, branch_id, member_id, plan_id,
              start_date, end_date, status, total_amount, paid_amount,
              discount_amount, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11, NOW(), NOW())
            RETURNING id, hash_id, start_date, end_date, status, total_amount, paid_amount, due_amount;`,
            [
              msHashId,
              orgId,
              finalBranchId,
              parsedMemberId,
              planId,
              startDateStr,
              endDateStr,
              lineTotal,
              itemPaidShare,
              lineDisc,
              userId
            ]
          );
          createdMemberships.push(msRes.rows[0]);
        }
      }

      // 7B. STUDIO CLASS / BATCH AUTO-BOOKING
      if ((item.item_type === 'class_enrollment' || item.item_type === 'class') && item.reference_id) {
        const scheduleId = parseInt(item.reference_id, 10);

        const schRes = await client.query(
          `SELECT cs.id, cs.class_id, c.max_capacity,
                  (SELECT COUNT(*) FROM class_bookings cb WHERE cb.class_schedule_id = cs.id AND cb.booking_status = 'confirmed') AS confirmed_count
           FROM class_schedules cs
           JOIN classes c ON cs.class_id = c.id
           WHERE cs.id = $1 AND c.organization_id = $2
           FOR UPDATE;`,
          [scheduleId, orgId]
        );

        if (schRes.rows.length > 0) {
          const schData = schRes.rows[0];
          const confirmedCount = parseInt(schData.confirmed_count, 10);
          const maxCapacity = parseInt(schData.max_capacity, 10);

          if (confirmedCount < maxCapacity) {
            const bookingHashId = generateHashId('cbk_');
            const bkRes = await client.query(
              `INSERT INTO class_bookings (
                hash_id, class_schedule_id, member_id, booking_status, booked_at, cancelled_at, invoice_id, invoice_item_id
              ) VALUES ($1, $2, $3, 'confirmed', NOW(), NULL, $4, $5)
              ON CONFLICT (class_schedule_id, member_id)
              DO UPDATE SET booking_status = 'confirmed', cancelled_at = NULL, invoice_id = EXCLUDED.invoice_id, invoice_item_id = EXCLUDED.invoice_item_id
              RETURNING *;`,
              [bookingHashId, scheduleId, parsedMemberId, invoice.id, invoiceItemId]
            );
            createdClassBookings.push({ ...bkRes.rows[0], status: 'confirmed' });
          } else {
            const waitlistCountRes = await client.query(
              'SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_pos FROM class_waitlists WHERE class_schedule_id = $1',
              [scheduleId]
            );
            const nextQueuePos = waitlistCountRes.rows[0].next_pos;
            const wlRes = await client.query(
              `INSERT INTO class_waitlists (
                class_schedule_id, member_id, queue_position, created_at
              ) VALUES ($1, $2, $3, NOW())
              ON CONFLICT (class_schedule_id, member_id)
              DO UPDATE SET queue_position = EXCLUDED.queue_position
              RETURNING *;`,
              [scheduleId, parsedMemberId, nextQueuePos]
            );
            createdClassBookings.push({ ...wlRes.rows[0], status: 'waitlisted', queue_position: nextQueuePos });
          }
        }
      }

      // 7C. Product stock movement deduction
      if (item.item_type === 'product' && item.reference_id) {
        const prodId = parseInt(item.reference_id, 10);
        const smHashId = generateHashId('smv_');
        await client.query(
          `INSERT INTO stock_movements (
            hash_id, organization_id, branch_id, product_id,
            movement_type, quantity, unit_cost, reference_type,
            reference_id, reason, created_by, created_at
          ) VALUES ($1, $2, $3, $4, 'sale_out', $5, $6, 'invoice', $7, 'Sold at POS Desk', $8, NOW());`,
          [
            smHashId,
            orgId,
            finalBranchId,
            prodId,
            lineQty,
            lineUnitPrice,
            invoice.id,
            userId
          ]
        );
      }

      // 7D. LOCKER AUTO-ALLOCATION (Single Source of Truth)
      if (item.item_type === 'locker' && item.reference_id) {
        const lockerId = parseInt(item.reference_id, 10);

        // Lock locker record to ensure race condition protection
        const lockerRes = await client.query(
          'SELECT * FROM lockers WHERE id = $1 AND organization_id = $2 FOR UPDATE',
          [lockerId, orgId]
        );

        if (lockerRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            message: `Locker #${item.description || lockerId} nahi mila.`
          });
        }

        const locker = lockerRes.rows[0];

        if (locker.status !== 'available') {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Locker #${locker.locker_number} available nahi hai (Current: ${locker.status}). Kisi aur member ko assign nahi kiya ja sakta.`
          });
        }

        const allocHashId = generateHashId('lka_');
        const startDateStr = item.start_date || new Date().toISOString().split('T')[0];
        const endDateStr = item.end_date || null;
        const chargedRent = parseFloat(item.unit_price || item.monthly_rent || 0);
        const chargedDeposit = parseFloat(item.security_deposit || 0);

        const allocRes = await client.query(
          `INSERT INTO locker_allocations (
            hash_id, locker_id, member_id, organization_id, branch_id,
            start_date, end_date, security_deposit, monthly_rent, status,
            invoice_id, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, NOW())
          RETURNING *;`,
          [
            allocHashId,
            locker.id,
            parsedMemberId,
            orgId,
            locker.branch_id,
            startDateStr,
            endDateStr,
            chargedDeposit,
            chargedRent,
            invoice.id,
            userId
          ]
        );

        // Update locker status
        await client.query(
          "UPDATE lockers SET status = 'occupied' WHERE id = $1 AND organization_id = $2",
          [locker.id, orgId]
        );

        createdLockerAllocations.push(allocRes.rows[0]);
      }
    }

    // 8. Capture Initial Payment (Installment #1)
    let recordedPayment = null;
    if (paidAmt > 0) {
      const receiptNum = await getNextReceiptNumber(client, orgId, finalBranchId);
      const balanceLeft = Math.max(0, finalTotal - paidAmt);
      const payHashId = generateHashId('pay_');

      const payRes = await client.query(
        `INSERT INTO payments (
          hash_id, organization_id, branch_id, member_id,
          amount, payment_method, transaction_reference, status,
          received_by_user_id, receipt_number, balance_after_payment, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', $8, $9, $10, NOW())
        RETURNING *;`,
        [
          payHashId,
          orgId,
          finalBranchId,
          parsedMemberId,
          paidAmt,
          initial_payment.payment_method || 'cash',
          initial_payment.transaction_reference || null,
          userId,
          receiptNum,
          balanceLeft
        ]
      );
      recordedPayment = payRes.rows[0];

      await client.query(
        `INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
         VALUES ($1, $2, $3);`,
        [recordedPayment.id, invoice.id, paidAmt]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      data: {
        ...invoice,
        payment: recordedPayment,
        activated_memberships: createdMemberships,
        class_bookings: createdClassBookings,
        locker_allocations: createdLockerAllocations
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Invoice Creation Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 2. RECORD SUBSEQUENT PAYMENT
// ================================================================
exports.recordPayment = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user?.orgId || req.user?.org_id;
  const userId = req.user?.userId || req.user?.id;
  const { invoice_id, branch_id, member_id, amount, payment_method, transaction_reference } = req.body;
  const finalBranchId = branch_id ? parseInt(branch_id, 10) : (req.user?.branch_id || req.user?.branchId);

  if (!invoice_id || !finalBranchId || !member_id || !amount || !payment_method) {
    client.release();
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    await client.query('BEGIN');

    const invRes = await client.query(
      `SELECT id, invoice_number, total_amount, payment_status 
       FROM invoices 
       WHERE id = $1 AND organization_id = $2 
       FOR UPDATE;`,
      [parseInt(invoice_id, 10), orgId]
    );

    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    const invoice = invRes.rows[0];

    const allocRes = await client.query(
      `SELECT COALESCE(SUM(allocated_amount), 0)::FLOAT as paid_sum 
       FROM payment_allocations 
       WHERE invoice_id = $1;`,
      [invoice.id]
    );
    const existingPaid = parseFloat(allocRes.rows[0].paid_sum);
    const incomingAmt = parseFloat(amount);
    const totalDue = parseFloat(invoice.total_amount) - existingPaid;

    if (incomingAmt > (totalDue + 0.01)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Amount exceeds due balance. Maximum due: ₹${totalDue.toFixed(2)}`
      });
    }

    const updatedTotalPaid = existingPaid + incomingAmt;
    const remainingBalance = Math.max(0, parseFloat(invoice.total_amount) - updatedTotalPaid);
    const newStatus = remainingBalance <= 0.01 ? 'paid' : 'partially_paid';

    const receiptNum = await getNextReceiptNumber(client, orgId, finalBranchId);
    const payHashId = generateHashId('pay_');

    const payRes = await client.query(
      `INSERT INTO payments (
        hash_id, organization_id, branch_id, member_id,
        amount, payment_method, transaction_reference, status,
        received_by_user_id, receipt_number, balance_after_payment, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', $8, $9, $10, NOW())
      RETURNING *;`,
      [
        payHashId,
        orgId,
        finalBranchId,
        parseInt(member_id, 10),
        incomingAmt,
        payment_method,
        transaction_reference || null,
        userId,
        receiptNum,
        remainingBalance
      ]
    );
    const newPayment = payRes.rows[0];

    await client.query(
      `INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount) 
       VALUES ($1, $2, $3);`,
      [newPayment.id, invoice.id, incomingAmt]
    );

    await client.query(
      `UPDATE invoices 
       SET payment_status = $1, updated_at = NOW() 
       WHERE id = $2;`,
      [newStatus, invoice.id]
    );

    const membershipItems = await client.query(
      `SELECT reference_id, total_price 
       FROM invoice_items 
       WHERE invoice_id = $1 AND item_type = 'membership' AND reference_id IS NOT NULL;`,
      [invoice.id]
    );

    for (const row of membershipItems.rows) {
      const planId = parseInt(row.reference_id, 10);
      const ratio = parseFloat(invoice.total_amount) > 0 
        ? parseFloat(row.total_price) / parseFloat(invoice.total_amount) 
        : 1;
      const incrementalMembershipPay = incomingAmt * ratio;

      await client.query(
        `UPDATE memberships 
         SET paid_amount = paid_amount + $1, updated_at = NOW()
         WHERE member_id = $2 AND plan_id = $3 AND organization_id = $4 AND status = 'active';`,
        [incrementalMembershipPay, parseInt(member_id, 10), planId, orgId]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: `Payment successful. Receipt #${receiptNum} issued.`,
      data: {
        payment: newPayment,
        receipt_number: receiptNum,
        updated_invoice_status: newStatus,
        remaining_due: remainingBalance
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment Recording Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 3. GET SINGLE INVOICE WITH COMPLETE SCHEDULE / RECEIPTS
// ================================================================
exports.getInvoiceById = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { id } = req.params;

  try {
    const invRes = await db.query(
      `SELECT i.*, 
              m.first_name, m.last_name, m.member_code, m.phone as member_phone, m.email as member_email,
              o.name as org_name, o.legal_name, o.tax_id_gst as org_gstin,
              b.name as branch_name, b.phone as branch_phone, b.address_line1 as branch_address, b.city as branch_city,
              COALESCE((SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0) as paid_sum
       FROM invoices i
       JOIN members m ON m.id = i.member_id
       JOIN organizations o ON o.id = i.organization_id
       LEFT JOIN branches b ON b.id = i.branch_id
       WHERE (i.id = $1 OR i.hash_id = $2) AND i.organization_id = $3;`,
      [isNaN(parseInt(id, 10)) ? -1 : parseInt(id, 10), id, orgId]
    );

    if (invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];

    const itemsRes = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC;',
      [invoice.id]
    );

    const paymentsRes = await db.query(
      `SELECT p.id, p.hash_id, p.receipt_number, p.amount, p.payment_method, 
              p.transaction_reference, p.balance_after_payment, p.status, p.created_at,
              pa.allocated_amount, u.name as staff_name
       FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id
       LEFT JOIN users u ON u.id = p.received_by_user_id
       WHERE pa.invoice_id = $1
       ORDER BY p.created_at ASC;`,
      [invoice.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...invoice,
        items: itemsRes.rows,
        payments: paymentsRes.rows
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. GET ALL PAYMENTS
// ================================================================
exports.getPaymentHistory = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { branch_id } = req.query;

  try {
    let query = `
      SELECT p.*, m.first_name, m.last_name, m.member_code, 
             u.name as received_by_name, pa.invoice_id, i.invoice_number, i.total_amount as invoice_total
      FROM payments p
      JOIN members m ON m.id = p.member_id
      LEFT JOIN users u ON u.id = p.received_by_user_id
      LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
      LEFT JOIN invoices i ON i.id = pa.invoice_id
      WHERE p.organization_id = $1
    `;
    const params = [orgId];
    if (branch_id && !isNaN(parseInt(branch_id, 10))) {
      params.push(parseInt(branch_id, 10));
      query += ` AND p.branch_id = $${params.length}`;
    }
    query += ` ORDER BY p.id DESC LIMIT 150;`;
    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 5. MEMBER FINANCIAL STATEMENT / LEDGER
// ================================================================
exports.getMemberLedger = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { memberId } = req.params;

  try {
    const parsedId = parseInt(memberId, 10);
    const ledger = await db.query(
      `SELECT 'INVOICE' as entry_type, id as ref_id, hash_id, invoice_number as document_no, 
              total_amount as debit, 0.00 as credit, created_at, notes
       FROM invoices
       WHERE member_id = $1 AND organization_id = $2
       UNION ALL
       SELECT 'PAYMENT' as entry_type, id as ref_id, hash_id, receipt_number as document_no,
              0.00 as debit, amount as credit, created_at, payment_method as notes
       FROM payments
       WHERE member_id = $1 AND organization_id = $2 AND status = 'success'
       ORDER BY created_at ASC;`,
      [parsedId, orgId]
    );

    return res.status(200).json({ success: true, data: ledger.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 6. GET ALL INVOICES LIST
// ================================================================
exports.getInvoices = exports.getAllInvoices = async (req, res) => {
  const orgId = req.user?.orgId || req.user?.org_id;
  const { member_id, branch_id, status } = req.query;
  try {
    let query = `
      SELECT i.*, m.first_name, m.last_name, m.member_code,
        COALESCE((SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0) as paid_sum
      FROM invoices i
      JOIN members m ON m.id = i.member_id
      WHERE i.organization_id = $1
    `;
    const params = [orgId];
    if (member_id) {
      params.push(parseInt(member_id, 10));
      query += ` AND i.member_id = $${params.length}`;
    }
    if (branch_id && !isNaN(parseInt(branch_id, 10))) {
      params.push(parseInt(branch_id, 10));
      query += ` AND i.branch_id = $${params.length}`;
    }
    if (status === 'due') {
      query += ` AND i.payment_status IN ('unpaid', 'partially_paid')`;
    } else if (status) {
      params.push(status);
      query += ` AND i.payment_status = $${params.length}`;
    }
    query += ` ORDER BY i.id DESC;`;
    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};