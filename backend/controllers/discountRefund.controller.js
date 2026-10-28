const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. OFFERS & COUPONS (Admin Level)
// ================================================================

// Create Base Offer (e.g., "Diwali Dhamaka - 20% Off")
exports.createOffer = async (req, res) => {
  const orgId = req.user.orgId;
  const {
    name,
    description,
    discount_type, // 'percentage' ya 'fixed'
    discount_value,
    start_date,
    end_date,
    max_uses
  } = req.body;

  if (!name || !discount_type || discount_value === undefined) {
    return res.status(400).json({
      success: false,
      message: 'name, discount_type aur discount_value required hain.'
    });
  }

  try {
    const hashId = generateHashId('ofr_');
    const query = `
      INSERT INTO offers (
        hash_id, organization_id, name, description, discount_type,
        discount_value, start_date, end_date, max_uses, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
      RETURNING *;
    `;
    const values = [
      hashId, orgId, name.trim(), description || null, discount_type,
      discount_value, start_date || null, end_date || null, max_uses || null
    ];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Offer created successfully.', offer: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Create Specific Coupon Code (e.g., Code: "DIWALI20", linked to Offer)
exports.createCoupon = async (req, res) => {
  const orgId = req.user.orgId;
  const { offer_id, code, max_uses, expires_at } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Coupon code required hai.' });
  }

  try {
    const hashId = generateHashId('cpn_');
    const query = `
      INSERT INTO coupons (
        hash_id, organization_id, offer_id, code, max_uses, used_count, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, 0, $6, TRUE)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      hashId, orgId, offer_id || null, code.trim().toUpperCase(), max_uses || null, expires_at || null
    ]);
    return res.status(201).json({ success: true, message: 'Coupon code created.', coupon: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ye coupon code pehle se exist karta hai.' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. APPLY COUPON TO AN INVOICE (Member Billing Flow)
// ================================================================
exports.applyCoupon = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const { invoice_id, coupon_code } = req.body;

  if (!invoice_id || !coupon_code) {
    return res.status(400).json({ success: false, message: 'invoice_id aur coupon_code required hain.' });
  }

  try {
    await client.query('BEGIN');

    // 1. Fetch Coupon & Offer details
   // REPLACE THIS QUERY IN applyCoupon:
const couponQuery = `
  SELECT c.*, o.discount_type, o.discount_value, o.start_date, o.end_date as offer_end_date
  FROM coupons c
  LEFT JOIN offers o ON c.offer_id = o.id
  WHERE c.organization_id = $1 AND c.code = $2 AND c.is_active = TRUE
  FOR UPDATE OF c;
`;
    const cpnRes = await client.query(couponQuery, [orgId, coupon_code.trim().toUpperCase()]);

    if (cpnRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Invalid ya expired coupon code.' });
    }
    const coupon = cpnRes.rows[0];

    // Check Max Usage Limit
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Is coupon ka maximum limit khatam ho chuka hai.' });
    }

    // Check Expiry Date
    const now = new Date();
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Coupon code expire ho chuka hai.' });
    }

    // 2. Fetch Invoice
    const invRes = await client.query(
      'SELECT id, member_id, subtotal, tax_amount, total_amount, payment_status FROM invoices WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [invoice_id, orgId]
    );

    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Invoice nahi mila.' });
    }
    const invoice = invRes.rows[0];

    if (invoice.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Ye invoice pehle se fully paid hai.' });
    }

    // 3. Calculate Discount Amount
    let discountAmount = 0.00;
    const subtotal = parseFloat(invoice.subtotal);

    if (coupon.discount_type === 'percentage') {
      discountAmount = (subtotal * parseFloat(coupon.discount_value)) / 100;
    } else {
      discountAmount = parseFloat(coupon.discount_value || 0);
    }
    discountAmount = Math.min(discountAmount, subtotal); // Discount subtotal se zyada nahi ho sakta

    const updatedTotal = Math.max(0, subtotal - discountAmount + parseFloat(invoice.tax_amount));

    // 4. Update Invoice
    await client.query(
      'UPDATE invoices SET discount_amount = $1, total_amount = $2, updated_at = NOW() WHERE id = $3',
      [discountAmount, updatedTotal, invoice.id]
    );

    // 5. Record Coupon Usage
    await client.query(
      `INSERT INTO coupon_usages (coupon_id, member_id, invoice_id, discount_amount, used_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [coupon.id, invoice.member_id, invoice.id, discountAmount]
    );

    // Increment Coupon used count
    await client.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [coupon.id]);

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Coupon successfully apply ho gaya.',
      data: {
        invoice_id: invoice.id,
        discount_amount: discountAmount,
        updated_total_amount: updatedTotal
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 3. REFUNDS (Payment Refund Processing)
// ================================================================
exports.processRefund = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const userId = req.user.userId;

  const { payment_id, amount, reason, refund_reference } = req.body;

  if (!payment_id || !amount) {
    return res.status(400).json({ success: false, message: 'payment_id aur amount zaroori hain.' });
  }

  try {
    await client.query('BEGIN');

    // 1. Verify Payment Record
    const payRes = await client.query(
      'SELECT id, amount, status FROM payments WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [payment_id, orgId]
    );

    if (payRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Payment record nahi mila.' });
    }
    const payment = payRes.rows[0];

    if (payment.status !== 'success') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Sirf successful payments par refund ho sakta hai.' });
    }

    // Check previously refunded amount
    const refSumRes = await client.query(
      "SELECT COALESCE(SUM(amount), 0) AS total_refunded FROM refunds WHERE payment_id = $1 AND status = 'success'",
      [payment_id]
    );
    const alreadyRefunded = parseFloat(refSumRes.rows[0].total_refunded);
    const refundAmt = parseFloat(amount);
    const maxRefundable = parseFloat(payment.amount) - alreadyRefunded;

    if (refundAmt > maxRefundable) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Refund amount maximum refundable balance se zyada hai. Maximum refundable: ₹${maxRefundable.toFixed(2)}`
      });
    }

    // 2. Insert Refund Record
    const hashId = generateHashId('ref_');
    const refQuery = `
      INSERT INTO refunds (
        hash_id, payment_id, amount, reason, refund_reference, status, processed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'success', $6, NOW())
      RETURNING *;
    `;
    const refRes = await client.query(refQuery, [
      hashId, payment_id, refundAmt, reason || null, refund_reference || null, userId
    ]);

    // 3. Agar poora amount refund ho gaya toh payment status 'refunded' set karein
    if (alreadyRefunded + refundAmt >= parseFloat(payment.amount)) {
      await client.query("UPDATE payments SET status = 'refunded' WHERE id = $1", [payment_id]);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Refund process ho gaya successfully.',
      refund: refRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. LIST OFFERS & COUPONS (Admin & Front Desk)
// ================================================================
exports.getOffersAndCoupons = async (req, res) => {
  const orgId = req.user.orgId;
  try {
    const [offersRes, couponsRes] = await Promise.all([
      db.query(
        'SELECT * FROM offers WHERE organization_id = $1 ORDER BY id DESC',
        [orgId]
      ),
      db.query(`
        SELECT c.*, o.name as offer_name, o.discount_type, o.discount_value
        FROM coupons c
        LEFT JOIN offers o ON c.offer_id = o.id
        WHERE c.organization_id = $1
        ORDER BY c.id DESC
      `, [orgId])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        offers: offersRes.rows,
        coupons: couponsRes.rows
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 5. LIST REFUNDS AUDIT TRAIL
// ================================================================
exports.getRefundHistory = async (req, res) => {
  const orgId = req.user.orgId;
  try {
    const query = `
      SELECT r.*, p.amount as original_payment_amount, p.payment_method,
             m.first_name, m.last_name, m.member_code,
             u.name as processed_by_name
      FROM refunds r
      JOIN payments p ON r.payment_id = p.id
      JOIN members m ON p.member_id = m.id
      LEFT JOIN users u ON r.processed_by = u.id
      WHERE p.organization_id = $1
      ORDER BY r.id DESC;
    `;
    const { rows } = await db.query(query, [orgId]);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};