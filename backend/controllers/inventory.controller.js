const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// Helper to safely insert into vendor_transactions
const insertVendorTransaction = async (client, { orgId, vendorId, type, amount, reference, notes }) => {
  const vtxHashId = generateHashId('vtx_');
  try {
    const res = await client.query(
      `INSERT INTO vendor_transactions (
        hash_id, organization_id, vendor_id, transaction_type, amount, reference, transaction_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7)
      RETURNING id, hash_id, amount::FLOAT, reference, transaction_date, notes;`,
      [vtxHashId, orgId, vendorId, type, amount, reference, notes]
    );
    return res.rows[0];
  } catch (err) {
    if (err.code === '42703') {
      const resFallback = await client.query(
        `INSERT INTO vendor_transactions (
          hash_id, vendor_id, transaction_type, amount, reference, transaction_date, notes
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6)
        RETURNING id, hash_id, amount::FLOAT, reference, transaction_date, notes;`,
        [vtxHashId, vendorId, type, amount, reference, notes]
      );
      return resFallback.rows[0];
    }
    throw err;
  }
};

// ================================================================
// 1. CREATE PRODUCT MASTER
// ================================================================
exports.createProduct = async (req, res) => {
  const orgId = req.user.orgId || req.user.organization_id;
  const { 
    category_id, 
    name, 
    sku, 
    barcode, 
    unit = 'piece', 
    reorder_level = 5,
    hsn_code = null,
    tax_rate = 18.00
  } = req.body;

  if (!name || !sku) {
    return res.status(400).json({ success: false, message: 'Product Name aur SKU code required hain.' });
  }

  try {
    const hashId = generateHashId('prd_');
    const query = `
      INSERT INTO products (
        hash_id, organization_id, category_id, name, sku, barcode,
        unit, purchase_price, selling_price, reorder_level, is_active,
        hsn_code, tax_rate, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0.00, 0.00, $8, TRUE, $9, $10, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      hashId, 
      orgId, 
      category_id || null, 
      name.trim(), 
      sku.trim().toUpperCase(), 
      barcode ? barcode.trim() : null, 
      unit, 
      parseInt(reorder_level || 5, 10),
      hsn_code ? hsn_code.trim().toUpperCase() : null, 
      parseFloat(tax_rate || 0)
    ];

    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Product catalog me add ho gaya.', product: rows[0] });
  } catch (error) {
    console.error('Create Product Error:', error);
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'SKU code already exists in your gym.' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// 2. RECEIVE PURCHASE ORDER (With Debit Note Adjustment & Freight)
// ================================================================
exports.receivePurchase = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId || req.user.organization_id;
  const userId = req.user.userId || req.user.id;
  let { 
    branch_id, 
    vendor_id, 
    purchase_number, 
    purchase_date, 
    subtotal, 
    tax_amount = 0.00, 
    freight_amount = 0.00,
    round_off_amount = 0.00, 
    total_amount, 
    items,
    paid_amount = 0.00,
    adjusted_debit_amount = 0.00,
    payment_method = 'bank_transfer',
    payment_reference = null
  } = req.body;

  let finalBranchId = branch_id && !isNaN(parseInt(branch_id, 10)) ? parseInt(branch_id, 10) : null;
  if (!finalBranchId && req.headers['x-branch-id']) finalBranchId = parseInt(req.headers['x-branch-id'], 10);
  if (!finalBranchId && req.user.branch_id) finalBranchId = parseInt(req.user.branch_id, 10);
  if (!finalBranchId) {
    const defaultBranchRes = await client.query(
      `SELECT id FROM branches WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`,
      [orgId]
    );
    finalBranchId = defaultBranchRes.rows[0]?.id || null;
  }

  if (!purchase_number || total_amount === undefined || !Array.isArray(items) || items.length === 0) {
    client.release();
    return res.status(400).json({ success: false, message: 'Purchase Number, Grand Total aur Items anivarya hain.' });
  }

  const finalTotal = parseFloat(total_amount);
  const paidAmt = isNaN(parseFloat(paid_amount)) ? 0.00 : parseFloat(paid_amount);
  const adjustedDebit = isNaN(parseFloat(adjusted_debit_amount)) ? 0.00 : parseFloat(adjusted_debit_amount);
  const finalFreight = isNaN(parseFloat(freight_amount)) ? 0.00 : parseFloat(freight_amount);

  const effectiveSettled = parseFloat((paidAmt + adjustedDebit).toFixed(2));

  let initialPayStatus = 'unpaid';
  if (effectiveSettled >= (finalTotal - 0.01)) {
    initialPayStatus = 'paid';
  } else if (effectiveSettled > 0.01) {
    initialPayStatus = 'partially_paid';
  }

  const cleanVendorId = vendor_id && !isNaN(parseInt(vendor_id, 10)) ? parseInt(vendor_id, 10) : null;

  try {
    await client.query('BEGIN');

    // Double safety check on available vendor credit
    if (adjustedDebit > 0 && cleanVendorId) {
      const creditRes = await client.query(
        `SELECT GREATEST(0, (
          COALESCE(SUM(CASE WHEN transaction_type = 'vendor_credit' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN transaction_type = 'credit_adjustment' THEN amount ELSE 0 END), 0)
        ))::FLOAT AS available_credit
        FROM vendor_transactions
        WHERE vendor_id = $1 AND organization_id = $2;`,
        [cleanVendorId, orgId]
      );
      const availableCredit = parseFloat(creditRes.rows[0]?.available_credit || 0);
      if (adjustedDebit > (availableCredit + 0.05)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Vendor Credit limit exceed ho gayi. Available Credit: ₹${availableCredit.toFixed(2)}, Claimed: ₹${adjustedDebit.toFixed(2)}`
        });
      }
    }

    const purchaseHashId = generateHashId('pur_');
    const totalTax = parseFloat(tax_amount || 0);
    const cgst = parseFloat((totalTax / 2).toFixed(2));
    const sgst = parseFloat((totalTax / 2).toFixed(2));
    const igst = 0.00;

    const purQuery = `
      INSERT INTO purchases (
        hash_id, organization_id, branch_id, vendor_id, purchase_number, 
        purchase_date, subtotal, tax_amount, cgst_amount, sgst_amount, igst_amount,
        freight_amount, round_off_amount, total_amount, paid_amount, payment_status, status, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'received', $17, NOW())
      RETURNING id, hash_id, purchase_number, total_amount, paid_amount, freight_amount, payment_status, branch_id, purchase_date;
    `;
    const purRes = await client.query(purQuery, [
      purchaseHashId, 
      orgId, 
      finalBranchId, 
      cleanVendorId, 
      purchase_number.trim(), 
      purchase_date || new Date().toISOString().split('T')[0], 
      parseFloat(subtotal || 0), 
      totalTax, 
      cgst, 
      sgst, 
      igst, 
      finalFreight,
      parseFloat(round_off_amount || 0),
      finalTotal,
      effectiveSettled,
      initialPayStatus,
      userId
    ]);
    const purchase = purRes.rows[0];

    for (const item of items) {
      const prodId = parseInt(item.product_id, 10);
      const qty = parseFloat(item.quantity);
      const unitCost = parseFloat(item.unit_cost);
      const sellingPrice = item.selling_price ? parseFloat(item.selling_price) : null;
      const taxRate = parseFloat(item.tax_rate || 0);
      const hsnCode = item.hsn_code ? String(item.hsn_code).trim().toUpperCase() : null;
      const lineSubtotal = qty * unitCost;
      const lineTax = item.tax_amount !== undefined ? parseFloat(item.tax_amount) : (lineSubtotal * (taxRate / 100));
      const lineTotalCost = parseFloat(item.total_cost || (lineSubtotal + lineTax));

      await client.query(
        `INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_cost, tax_rate, tax_amount, 
          total_cost, expiry_date, batch_number, hsn_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          purchase.id, 
          prodId, 
          qty, 
          unitCost, 
          taxRate, 
          lineTax, 
          lineTotalCost, 
          item.expiry_date || null, 
          item.batch_number ? String(item.batch_number).trim() : null, 
          hsnCode
        ]
      );

      const mvtHashId = generateHashId('smv_');
      await client.query(
        `INSERT INTO stock_movements (
          hash_id, organization_id, branch_id, product_id, movement_type, 
          quantity, unit_cost, reference_type, reference_id, reason, created_by, created_at
        ) VALUES ($1, $2, $3, $4, 'purchase_in', $5, $6, 'purchases', $7, 'Vendor Purchase Restock (GRN)', $8, NOW())`,
        [mvtHashId, orgId, finalBranchId, prodId, qty, unitCost, purchase.id, userId]
      );

      let updateQuery = `UPDATE products SET purchase_price = $1, updated_at = NOW()`;
      const updateParams = [unitCost];
      let pIdx = 2;
      if (sellingPrice !== null && !isNaN(sellingPrice)) {
        updateQuery += `, selling_price = $${pIdx}`;
        updateParams.push(sellingPrice);
        pIdx++;
      }
      if (taxRate >= 0) {
        updateQuery += `, tax_rate = $${pIdx}`;
        updateParams.push(taxRate);
        pIdx++;
      }
      if (hsnCode) {
        updateQuery += `, hsn_code = $${pIdx}`;
        updateParams.push(hsnCode);
        pIdx++;
      }
      updateQuery += ` WHERE id = $${pIdx} AND organization_id = $${pIdx + 1}`;
      updateParams.push(prodId, orgId);
      await client.query(updateQuery, updateParams);
    }

    // Direct payment
    if (paidAmt > 0 && cleanVendorId) {
      await insertVendorTransaction(client, {
        orgId,
        vendorId: cleanVendorId,
        type: 'payment_out',
        amount: paidAmt,
        reference: payment_reference || `PO Payment #${purchase.purchase_number}`,
        notes: `Paid ₹${paidAmt.toFixed(2)} via ${payment_method.toUpperCase()} for PO #${purchase.purchase_number}`
      });
    }

    // Debit note credit adjustment (reduces available vendor credit wallet)
    if (adjustedDebit > 0 && cleanVendorId) {
      await insertVendorTransaction(client, {
        orgId,
        vendorId: cleanVendorId,
        type: 'credit_adjustment',
        amount: adjustedDebit,
        reference: `ADJ-${purchase.purchase_number}`,
        notes: `Adjusted ₹${adjustedDebit.toFixed(2)} from previous Debit Note credit on PO #${purchase.purchase_number}`
      });
    }

    await client.query('COMMIT');
    const dueAmount = Math.max(0, finalTotal - effectiveSettled);

    return res.status(201).json({ 
      success: true, 
      message: 'Inward Stock and Purchase recorded successfully.', 
      purchase: {
        ...purchase,
        freight_amount: finalFreight,
        paid_amount: effectiveSettled,
        due_amount: dueAmount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Receive Purchase Critical Error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Yeh PO Reference Number pehle se registered hai.' });
    }
    return res.status(500).json({ success: false, message: `Purchase record karne me error: ${error.message}` });
  } finally {
    client.release();
  }
};

// ================================================================
// 3. SETTLE VENDOR DUE PAYMENT
// ================================================================
exports.recordVendorPayment = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId || req.user.organization_id;
  const { purchase_id, amount, payment_method = 'bank_transfer', reference } = req.body;

  if (!purchase_id || !amount || parseFloat(amount) <= 0) {
    client.release();
    return res.status(400).json({ success: false, message: 'Valid purchase_id aur positive amount zaroori hain.' });
  }

  const payAmt = parseFloat(parseFloat(amount).toFixed(2));
  const cleanPurchaseId = parseInt(purchase_id, 10);

  try {
    await client.query('BEGIN');

    const purRes = await client.query(
      `SELECT id, purchase_number, vendor_id, total_amount::FLOAT, COALESCE(paid_amount, 0)::FLOAT AS paid_amount
       FROM purchases
       WHERE id = $1 AND organization_id = $2
       FOR UPDATE;`,
      [cleanPurchaseId, orgId]
    );

    if (purRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Purchase Order nahi mila ya unauthorized access hai.' });
    }

    const purchase = purRes.rows[0];
    const totalAmount = parseFloat(purchase.total_amount);
    const existingPaid = parseFloat(purchase.paid_amount);
    const currentDue = Math.max(0, totalAmount - existingPaid);

    if (payAmt > (currentDue + 0.05)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Settlement amount pending balance se zyada hai. Maximum allowed pending: ₹${currentDue.toFixed(2)}`
      });
    }

    const newPaidTotal = parseFloat((existingPaid + payAmt).toFixed(2));
    const newDue = Math.max(0, parseFloat((totalAmount - newPaidTotal).toFixed(2)));
    const newStatus = newDue <= 0.01 ? 'paid' : 'partially_paid';

    const updateRes = await client.query(
      `UPDATE purchases 
       SET paid_amount = $1, payment_status = $2 
       WHERE id = $3 AND organization_id = $4
       RETURNING id, purchase_number, total_amount::FLOAT, paid_amount::FLOAT, payment_status;`,
      [newPaidTotal, newStatus, purchase.id, orgId]
    );

    let createdTransaction = null;
    if (purchase.vendor_id) {
      const txRef = reference && reference.trim() ? reference.trim() : `PAY-${Date.now().toString().slice(-6)}`;
      const txNotes = `Installment payment of ₹${payAmt.toFixed(2)} via ${payment_method.toUpperCase()} for PO #${purchase.purchase_number}`;

      createdTransaction = await insertVendorTransaction(client, {
        orgId,
        vendorId: purchase.vendor_id,
        type: 'payment_out',
        amount: payAmt,
        reference: txRef,
        notes: txNotes
      });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `₹${payAmt.toFixed(2)} ki partial payment safaltapoorvak darj kar li gayi hai.`,
      purchase: {
        ...updateRes.rows[0],
        due_amount: newDue
      },
      transaction: createdTransaction
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error settling vendor payment:', error);
    return res.status(500).json({ success: false, message: 'Settlement process fail hua: ' + error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 4. POS DIRECT SALE
// ================================================================
exports.posSale = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId || req.user.organization_id;
  const userId = req.user.userId || req.user.id;
  const { 
    branch_id, 
    member_id, 
    invoice_number, 
    subtotal, 
    tax_amount = 0.00, 
    discount_amount = 0.00, 
    round_off_amount = 0.00, 
    total_amount, 
    payment_method = 'cash', 
    items 
  } = req.body;

  let finalBranchId = branch_id && !isNaN(parseInt(branch_id, 10)) ? parseInt(branch_id, 10) : null;
  if (!finalBranchId && req.headers['x-branch-id']) finalBranchId = parseInt(req.headers['x-branch-id'], 10);
  if (!finalBranchId && req.user.branch_id) finalBranchId = parseInt(req.user.branch_id, 10);

  if (!finalBranchId || !invoice_number || total_amount === undefined || !Array.isArray(items) || items.length === 0) {
    client.release();
    return res.status(400).json({ success: false, message: 'Incomplete POS payload or missing branch.' });
  }

  try {
    await client.query('BEGIN');
    for (const item of items) {
      const prodId = parseInt(item.product_id, 10);
      const reqQty = parseFloat(item.quantity);
      const stockRes = await client.query(
        `SELECT COALESCE(SUM(
          CASE 
            WHEN LOWER(movement_type) IN ('purchase_in', 'adjustment_add', 'return_in', 'inward', 'opening_stock') THEN quantity 
            WHEN LOWER(movement_type) IN ('sale_out', 'adjustment_sub', 'damage_out', 'outward', 'purchase_return') THEN -quantity 
            ELSE 0 
          END
        ), 0)::FLOAT AS current_stock
        FROM stock_movements
        WHERE product_id = $1 AND organization_id = $2 AND branch_id = $3`,
        [prodId, orgId, finalBranchId]
      );
      const availableStock = parseFloat(stockRes.rows[0]?.current_stock || 0);
      if (availableStock < reqQty) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ID #${prodId}. Available: ${availableStock}, Requested: ${reqQty}`
        });
      }
    }

    const invoiceHashId = generateHashId('inv_');
    const totalTax = parseFloat(tax_amount || 0);
    const cgst = parseFloat((totalTax / 2).toFixed(2));
    const sgst = parseFloat((totalTax / 2).toFixed(2));
    const invoiceRes = await client.query(
      `INSERT INTO invoices (
        hash_id, organization_id, branch_id, member_id, invoice_number, 
        subtotal, discount_amount, tax_amount, cgst_amount, sgst_amount, igst_amount,
        round_off_amount, total_amount, payment_status, due_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, 'paid', CURRENT_DATE, NOW(), NOW()) 
      RETURNING id, hash_id, invoice_number, total_amount;`,
      [
        invoiceHashId, 
        orgId, 
        finalBranchId, 
        member_id ? parseInt(member_id, 10) : null, 
        invoice_number.trim(), 
        parseFloat(subtotal), 
        parseFloat(discount_amount), 
        totalTax, 
        cgst, 
        sgst, 
        parseFloat(round_off_amount || 0), 
        parseFloat(total_amount)
      ]
    );

    const invoiceId = invoiceRes.rows[0].id;
    for (const item of items) {
      const prodId = parseInt(item.product_id, 10);
      const qty = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.unit_price);
      const lineTax = parseFloat(item.tax_amount || 0);

      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, item_type, reference_id, description, quantity, 
          unit_price, discount_amount, tax_amount, total_price
        ) VALUES ($1, 'product', $2, $3, $4, $5, $6, $7, $8)`,
        [
          invoiceId, 
          prodId, 
          item.description || 'Retail Product', 
          qty, 
          unitPrice, 
          parseFloat(item.discount_amount || 0), 
          lineTax, 
          parseFloat(item.total_price)
        ]
      );

      const smvHashId = generateHashId('smv_');
      await client.query(
        `INSERT INTO stock_movements (
          hash_id, organization_id, branch_id, product_id, movement_type, 
          quantity, unit_cost, reference_type, reference_id, reason, created_by, created_at
        ) VALUES ($1, $2, $3, $4, 'sale_out', $5, $6, 'invoices', $7, 'POS Counter Sale', $8, NOW())`,
        [smvHashId, orgId, finalBranchId, prodId, qty, unitPrice, invoiceId, userId]
      );
    }

    const payHashId = generateHashId('pay_');
    const payRes = await client.query(
      `INSERT INTO payments (
        hash_id, organization_id, branch_id, member_id, amount, payment_method, status, received_by_user_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'success', $7, NOW()) RETURNING id;`,
      [payHashId, orgId, finalBranchId, member_id ? parseInt(member_id, 10) : null, parseFloat(total_amount), payment_method, userId]
    );

    await client.query(
      `INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1, $2, $3)`, 
      [payRes.rows[0].id, invoiceId, parseFloat(total_amount)]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'POS Sale complete.', invoice: invoiceRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('POS Sale Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 5. GET PRODUCT STOCK LEDGER
// ================================================================
exports.getProductStock = async (req, res) => {
  const orgId = req.user.orgId || req.user.organization_id;
  const { branch_id } = req.query;

  let finalBranchId = branch_id && !isNaN(parseInt(branch_id, 10)) 
    ? parseInt(branch_id, 10) 
    : (req.user.branch_id || null);

  if (!finalBranchId && req.headers['x-branch-id']) {
    finalBranchId = parseInt(req.headers['x-branch-id'], 10);
  }

  try {
    const query = `
      SELECT
        p.id AS product_id,
        p.id,
        p.hash_id,
        p.name,
        p.sku,
        p.barcode,
        p.unit,
        p.purchase_price::FLOAT AS purchase_price,
        p.selling_price::FLOAT AS selling_price,
        p.reorder_level::FLOAT AS reorder_level,
        p.hsn_code,
        p.tax_rate::FLOAT AS tax_rate,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN LOWER(sm.movement_type) IN ('purchase_in', 'adjustment_add', 'return_in', 'inward', 'opening_stock') THEN sm.quantity
              WHEN LOWER(sm.movement_type) IN ('sale_out', 'adjustment_sub', 'damage_out', 'outward', 'purchase_return') THEN -sm.quantity
              ELSE 0
            END
          )
          FROM stock_movements sm
          WHERE sm.product_id = p.id
            AND sm.organization_id = $1
            AND ($2::BIGINT IS NULL OR sm.branch_id IS NULL OR sm.branch_id = $2::BIGINT)
        ), 0)::FLOAT AS current_stock,
        COALESCE((
          SELECT json_agg(json_build_object(
            'batch_number', pi.batch_number,
            'expiry_date', pi.expiry_date,
            'unit_cost', pi.unit_cost
          ) ORDER BY pi.expiry_date ASC NULLS LAST)
          FROM purchase_items pi
          JOIN purchases pur ON pur.id = pi.purchase_id
          WHERE pi.product_id = p.id AND pur.organization_id = $1
        ), '[]'::json) AS available_batches
      FROM products p
      WHERE p.organization_id = $1 AND p.is_active = TRUE
      ORDER BY p.name ASC;
    `;
    const { rows } = await db.query(query, [orgId, finalBranchId]);
    return res.status(200).json({ success: true, count: rows.length, stock: rows, data: rows });
  } catch (error) {
    console.error('Error in getProductStock:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 6. GET PURCHASES HISTORY
// ================================================================
exports.getPurchases = async (req, res) => {
  const orgId = req.user.orgId || req.user.organization_id;
  const { 
    branch_id, 
    search, 
    status, 
    vendor_id, 
    start_date, 
    end_date, 
    limit = 50, 
    offset = 0 
  } = req.query;

  let finalBranchId = branch_id && !isNaN(parseInt(branch_id, 10)) ? parseInt(branch_id, 10) : null;
  if (!finalBranchId && req.headers['x-branch-id']) {
    finalBranchId = parseInt(req.headers['x-branch-id'], 10);
  }

  try {
    let whereClauses = [`p.organization_id = $1`];
    let params = [orgId];

    if (finalBranchId) {
      params.push(finalBranchId);
      whereClauses.push(`(p.branch_id = $${params.length} OR p.branch_id IS NULL)`);
    }

    if (status && ['paid', 'partially_paid', 'unpaid'].includes(status.toLowerCase())) {
      params.push(status.toLowerCase());
      whereClauses.push(`p.payment_status = $${params.length}`);
    }

    if (vendor_id && !isNaN(parseInt(vendor_id, 10))) {
      params.push(parseInt(vendor_id, 10));
      whereClauses.push(`p.vendor_id = $${params.length}`);
    }

    if (start_date) {
      params.push(start_date);
      whereClauses.push(`p.purchase_date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      whereClauses.push(`p.purchase_date <= $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const sIdx = params.length;
      whereClauses.push(`(
        LOWER(p.purchase_number) LIKE $${sIdx} OR
        LOWER(COALESCE(v.name, 'Direct Supplier')) LIKE $${sIdx} OR
        LOWER(COALESCE(v.tax_id_gst, '')) LIKE $${sIdx} OR
        EXISTS (
          SELECT 1 
          FROM purchase_items pi_search 
          JOIN products pr_search ON pi_search.product_id = pr_search.id 
          WHERE pi_search.purchase_id = p.id 
            AND (
              LOWER(pr_search.name) LIKE $${sIdx} OR 
              LOWER(pr_search.sku) LIKE $${sIdx} OR 
              LOWER(COALESCE(pi_search.batch_number, '')) LIKE $${sIdx}
            )
        )
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    const summaryQuery = `
      SELECT 
        COUNT(p.id)::INT AS total_count,
        COALESCE(SUM(p.total_amount), 0)::FLOAT AS total_billed,
        COALESCE(SUM(COALESCE(p.paid_amount, 0)), 0)::FLOAT AS total_paid,
        COALESCE(SUM(GREATEST(0, p.total_amount - COALESCE(p.paid_amount, 0))), 0)::FLOAT AS total_due,
        COUNT(CASE WHEN p.payment_status = 'unpaid' THEN 1 END)::INT AS unpaid_count,
        COUNT(CASE WHEN p.payment_status = 'partially_paid' THEN 1 END)::INT AS partial_count,
        COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END)::INT AS paid_count
      FROM purchases p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE ${whereSql};
    `;
    const summaryRes = await db.query(summaryQuery, params);
    const summary = summaryRes.rows[0] || {
      total_count: 0,
      total_billed: 0,
      total_paid: 0,
      total_due: 0,
      unpaid_count: 0,
      partial_count: 0,
      paid_count: 0,
    };

    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

    params.push(pageLimit);
    const limitIdx = params.length;
    params.push(pageOffset);
    const offsetIdx = params.length;

    const listQuery = `
      SELECT
        p.id, 
        p.hash_id, 
        p.purchase_number, 
        p.purchase_date, 
        p.branch_id,
        COALESCE(b.name, 'Main Branch') AS branch_name,
        p.subtotal::FLOAT AS subtotal, 
        p.tax_amount::FLOAT AS tax_amount, 
        p.cgst_amount::FLOAT AS cgst_amount, 
        p.sgst_amount::FLOAT AS sgst_amount, 
        p.igst_amount::FLOAT AS igst_amount, 
        COALESCE(p.freight_amount, 0.00)::FLOAT AS freight_amount,
        p.round_off_amount::FLOAT AS round_off_amount, 
        p.total_amount::FLOAT AS total_amount, 
        COALESCE(p.paid_amount, 0)::FLOAT AS paid_amount, 
        GREATEST(0, (p.total_amount - COALESCE(p.paid_amount, 0)))::FLOAT AS due_amount, 
        COALESCE(p.payment_status, 'unpaid') AS payment_status, 
        p.status, 
        v.id AS vendor_id, 
        v.name AS vendor_name, 
        v.tax_id_gst AS vendor_gstin, 
        v.phone AS vendor_phone,
        COALESCE((
          SELECT json_agg(json_build_object(
            'product_id', pi.product_id,
            'product_name', pr.name, 
            'sku', pr.sku, 
            'hsn_code', pi.hsn_code, 
            'quantity', pi.quantity, 
            'unit_cost', pi.unit_cost, 
            'tax_rate', pi.tax_rate, 
            'tax_amount', pi.tax_amount, 
            'total_cost', pi.total_cost, 
            'batch_number', pi.batch_number, 
            'expiry_date', pi.expiry_date
          )) 
          FROM purchase_items pi 
          JOIN products pr ON pi.product_id = pr.id 
          WHERE pi.purchase_id = p.id
        ), '[]'::json) AS items,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', vt.id,
            'amount', vt.amount::FLOAT,
            'transaction_date', vt.transaction_date,
            'reference', vt.reference,
            'notes', vt.notes
          ) ORDER BY vt.id ASC)
          FROM vendor_transactions vt
          WHERE vt.vendor_id = p.vendor_id 
            AND (vt.notes LIKE '%' || p.purchase_number || '%' OR vt.reference LIKE '%' || p.purchase_number || '%')
        ), '[]'::json) AS payments_history
      FROM purchases p
      LEFT JOIN branches b ON p.branch_id = b.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE ${whereSql}
      ORDER BY p.purchase_date DESC, p.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const { rows } = await db.query(listQuery, params);
    return res.status(200).json({ 
      success: true, 
      count: summary.total_count,
      data: rows,
      purchases: rows,
      summary: summary,
      limit: pageLimit,
      offset: pageOffset
    });
  } catch (error) {
    console.error('getPurchases Database Error:', error);
    return res.status(500).json({ success: false, message: 'Purchases load nahi hui.', error: error.message });
  }
};

// ================================================================
// 7. RECORD PURCHASE RETURN & SMART CREDIT ADJUSTMENT (FIXED)
// ================================================================
exports.recordPurchaseReturn = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId || req.user.organization_id;
  const userId = req.user.userId || req.user.id;
  const {
    purchase_id,
    return_date = new Date().toISOString().split('T')[0],
    reason,
    refund_type = 'vendor_credit',
    items
  } = req.body;

  if (!purchase_id || !Array.isArray(items) || items.length === 0 || !reason) {
    client.release();
    return res.status(400).json({ 
      success: false, 
      message: 'Purchase ID, Return Reason aur Items ki list anivarya hain.' 
    });
  }

  const cleanPurchaseId = parseInt(purchase_id, 10);

  try {
    await client.query('BEGIN');

    const purRes = await client.query(
      `SELECT p.*, v.name AS vendor_name, v.tax_id_gst AS vendor_gstin 
       FROM purchases p 
       LEFT JOIN vendors v ON p.vendor_id = v.id 
       WHERE p.id = $1 AND p.organization_id = $2 
       FOR UPDATE OF p;`,
      [cleanPurchaseId, orgId]
    );

    if (purRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Original Purchase Order nahi mila.' });
    }

    const purchase = purRes.rows[0];

    const originalItemsRes = await client.query(
      `SELECT product_id, quantity::FLOAT AS quantity 
       FROM purchase_items 
       WHERE purchase_id = $1`,
      [cleanPurchaseId]
    );

    const alreadyReturnedRes = await client.query(
      `SELECT pri.product_id, COALESCE(SUM(pri.quantity), 0)::FLOAT AS returned_qty
       FROM purchase_return_items pri
       JOIN purchase_returns pr ON pri.return_id = pr.id
       WHERE pr.purchase_id = $1
       GROUP BY pri.product_id`,
      [cleanPurchaseId]
    );

    const purchasedMap = {};
    originalItemsRes.rows.forEach(r => { purchasedMap[parseInt(r.product_id, 10)] = r.quantity; });

    const returnedMap = {};
    alreadyReturnedRes.rows.forEach(r => { returnedMap[parseInt(r.product_id, 10)] = r.returned_qty; });

    for (const it of items) {
      const pId = parseInt(it.product_id, 10);
      const returnQty = parseFloat(it.quantity);

      if (isNaN(pId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Valid Product ID missing hai return list me.' });
      }

      if (isNaN(returnQty) || returnQty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Return quantity 0 se badi honi chahiye.' });
      }

      const originalQty = purchasedMap[pId] || 0;
      const prevReturned = returnedMap[pId] || 0;
      const poRemaining = Math.max(0, originalQty - prevReturned);

      if (returnQty > poRemaining) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Product ID #${pId}: PO balance exceed ho gaya. Purchase ki gayi units: ${originalQty}, Pehle se returned: ${prevReturned}, Max returnable: ${poRemaining}, Aapne enter kiya: ${returnQty}`
        });
      }

      const stockRes = await client.query(
        `SELECT COALESCE(SUM(
          CASE 
            WHEN LOWER(movement_type) IN ('purchase_in', 'adjustment_add', 'return_in', 'inward', 'opening_stock') THEN quantity 
            WHEN LOWER(movement_type) IN ('sale_out', 'adjustment_sub', 'damage_out', 'outward', 'purchase_return') THEN -quantity 
            ELSE 0 
          END
        ), 0)::FLOAT AS current_stock
        FROM stock_movements
        WHERE product_id = $1 AND organization_id = $2 AND branch_id = $3`,
        [pId, orgId, purchase.branch_id]
      );

      const availableStock = parseFloat(stockRes.rows[0]?.current_stock || 0);

      if (returnQty > availableStock) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Stock Deficit: Product ID #${pId} ka actual physical stock sirf ${availableStock} units bacha hai. Aap ${returnQty} return nahi kar sakte.`
        });
      }
    }

    let returnSubtotal = 0;
    let returnTaxTotal = 0;

    const calculatedItems = items.map(it => {
      const q = parseFloat(it.quantity);
      const c = parseFloat(it.unit_cost);
      const rate = parseFloat(it.tax_rate || 0);
      const lineSub = q * c;
      const lineTax = parseFloat((lineSub * (rate / 100)).toFixed(2));
      const lineTot = parseFloat((lineSub + lineTax).toFixed(2));

      returnSubtotal += lineSub;
      returnTaxTotal += lineTax;

      return {
        ...it,
        product_id: parseInt(it.product_id, 10),
        quantity: q,
        unit_cost: c,
        tax_rate: rate,
        tax_amount: lineTax,
        total_amount: lineTot
      };
    });

    const returnGrandTotal = parseFloat((returnSubtotal + returnTaxTotal).toFixed(2));
    const cgst = parseFloat((returnTaxTotal / 2).toFixed(2));
    const sgst = parseFloat((returnTaxTotal / 2).toFixed(2));

    const debitNoteNumber = `DN-${Date.now().toString().slice(-6)}`;
    const returnHashId = generateHashId('ret_');

    const retRes = await client.query(
      `INSERT INTO purchase_returns (
        hash_id, organization_id, branch_id, purchase_id, vendor_id, 
        debit_note_number, return_date, subtotal, tax_amount, cgst_amount, 
        sgst_amount, igst_amount, total_amount, reason, refund_type, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0.00, $12, $13, $14, $15, NOW())
      RETURNING *;`,
      [
        returnHashId, orgId, purchase.branch_id, purchase.id, purchase.vendor_id,
        debitNoteNumber, return_date, returnSubtotal, returnTaxTotal, cgst, sgst,
        returnGrandTotal, reason.trim(), refund_type, userId
      ]
    );

    const debitNote = retRes.rows[0];

    for (const item of calculatedItems) {
      await client.query(
        `INSERT INTO purchase_return_items (
          return_id, product_id, quantity, unit_cost, tax_rate, tax_amount, total_amount, batch_number, hsn_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          debitNote.id, item.product_id, item.quantity, item.unit_cost, item.tax_rate,
          item.tax_amount, item.total_amount, item.batch_number || null, item.hsn_code || null
        ]
      );

      const smvHashId = generateHashId('smv_');
      await client.query(
        `INSERT INTO stock_movements (
          hash_id, organization_id, branch_id, product_id, movement_type, 
          quantity, unit_cost, reference_type, reference_id, reason, created_by, created_at
        ) VALUES ($1, $2, $3, $4, 'purchase_return', $5, $6, 'purchase_returns', $7, $8, $9, NOW())`,
        [
          smvHashId, orgId, purchase.branch_id, item.product_id, item.quantity, item.unit_cost,
          debitNote.id, `Vendor Return / Debit Note: ${debitNoteNumber}`, userId
        ]
      );
    }

    // ==============================================================
    // PRECISE FINANCIAL SETTLEMENT LOGIC (FIXED)
    // ==============================================================
    const currentTotal = parseFloat(purchase.total_amount);
    const currentPaid = parseFloat(purchase.paid_amount || 0);
    const currentPendingDue = Math.max(0, parseFloat((currentTotal - currentPaid).toFixed(2)));

    // 1. PO ka bill amount actual return value se reduce karo
    const newInvoiceTotal = Math.max(0, parseFloat((currentTotal - returnGrandTotal).toFixed(2)));
    
    // Agar bill par return ke baad paid amount zyada nikalta hai (overpayment)
    const excessOverpaid = Math.max(0, parseFloat((currentPaid - newInvoiceTotal).toFixed(2)));
    
    // Naya effective paid amount jo is bill par allocated rahega
    const adjustedPaidAmount = parseFloat((currentPaid - excessOverpaid).toFixed(2));
    const newRemainingDue = Math.max(0, parseFloat((newInvoiceTotal - adjustedPaidAmount).toFixed(2)));
    const newStatus = newRemainingDue <= 0.01 ? 'paid' : (adjustedPaidAmount > 0 ? 'partially_paid' : 'unpaid');

    await client.query(
      `UPDATE purchases 
       SET total_amount = $1, paid_amount = $2, payment_status = $3 
       WHERE id = $4 AND organization_id = $5`,
      [newInvoiceTotal, adjustedPaidAmount, newStatus, purchase.id, orgId]
    );

    let settlementSummaryMessage = '';

    if (purchase.vendor_id) {
      // 1. Audit trail ke liye bill-level debit note adjustment
      const billAdjustedAmount = Math.min(currentPendingDue, returnGrandTotal);
      if (billAdjustedAmount > 0) {
        await insertVendorTransaction(client, {
          orgId,
          vendorId: purchase.vendor_id,
          type: 'debit_note',
          amount: billAdjustedAmount,
          reference: debitNoteNumber,
          notes: `Debit Note #${debitNoteNumber}: Settled ₹${billAdjustedAmount.toFixed(2)} against pending due of PO #${purchase.purchase_number}`
        });
      }

      // 2. Kripya dhyan dein: SIRF excess balance hi Vendor Advance Wallet ('vendor_credit') banega!
      // Example: 10,080 return hua, 10,000 due bill me adjust ho gaya, to wallet me sirf ₹80.00 jayega.
      const walletAdvanceCredit = parseFloat(excessOverpaid.toFixed(2));
      if (walletAdvanceCredit > 0) {
        await insertVendorTransaction(client, {
          orgId,
          vendorId: purchase.vendor_id,
          type: 'vendor_credit',
          amount: walletAdvanceCredit,
          reference: debitNoteNumber,
          notes: `Excess Advance Credit #${debitNoteNumber}: ₹${walletAdvanceCredit.toFixed(2)} credited to vendor wallet for future POs. Reason: ${reason}`
        });
        settlementSummaryMessage = `PO #${purchase.purchase_number} ka due clear hua aur excess overpaid ₹${walletAdvanceCredit.toFixed(2)} Vendor Credit Wallet me jama ho gaya.`;
      } else {
        settlementSummaryMessage = `PO #${purchase.purchase_number} ka due balance ₹${billAdjustedAmount.toFixed(2)} se adjust kar diya gaya hai.`;
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Debit Note #${debitNoteNumber} generated successfully. ${settlementSummaryMessage}`,
      debit_note: debitNote
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Purchase Return Critical Error:', error);
    return res.status(500).json({ success: false, message: 'Purchase return process failed: ' + error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 8. GET VENDOR OUTSTANDING CREDIT BALANCE (FIXED)
// ================================================================
exports.getVendorCredits = async (req, res) => {
  const orgId = req.user.orgId || req.user.organization_id;
  const { vendor_id } = req.params;

  if (!vendor_id || isNaN(parseInt(vendor_id, 10))) {
    return res.status(400).json({ success: false, message: 'Valid vendor ID zaroori hai.' });
  }

  try {
    // Only 'vendor_credit' represents genuine unadjusted advance balance for future POs.
    // 'credit_adjustment' represents usage of that advance balance on new POs.
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'vendor_credit' THEN amount ELSE 0 END), 0)::FLOAT AS total_debit_credits,
        COALESCE(SUM(CASE WHEN transaction_type = 'credit_adjustment' THEN amount ELSE 0 END), 0)::FLOAT AS total_adjusted_credits,
        GREATEST(0, (
          COALESCE(SUM(CASE WHEN transaction_type = 'vendor_credit' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN transaction_type = 'credit_adjustment' THEN amount ELSE 0 END), 0)
        ))::FLOAT AS available_credit_balance
      FROM vendor_transactions
      WHERE vendor_id = $1 AND organization_id = $2;
    `;
    const { rows } = await db.query(query, [parseInt(vendor_id, 10), orgId]);
    return res.status(200).json({
      success: true,
      vendor_id: parseInt(vendor_id, 10),
      credits: rows[0] || { available_credit_balance: 0 }
    });
  } catch (error) {
    console.error('Get Vendor Credits Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// 9. GET PURCHASE RETURNS LIST
// ================================================================
exports.getPurchaseReturns = async (req, res) => {
  const orgId = req.user.orgId || req.user.organization_id;
  const { branch_id, purchase_id } = req.query;

  try {
    let query = `
      SELECT 
        pr.*, 
        p.purchase_number,
        v.name AS vendor_name,
        v.tax_id_gst AS vendor_gstin,
        COALESCE((
          SELECT json_agg(json_build_object(
            'product_name', prd.name,
            'sku', prd.sku,
            'quantity', pri.quantity,
            'unit_cost', pri.unit_cost,
            'tax_rate', pri.tax_rate,
            'tax_amount', pri.tax_amount,
            'total_amount', pri.total_amount,
            'batch_number', pri.batch_number
          ))
          FROM purchase_return_items pri
          JOIN products prd ON pri.product_id = prd.id
          WHERE pri.return_id = pr.id
        ), '[]'::json) AS items
      FROM purchase_returns pr
      JOIN purchases p ON pr.purchase_id = p.id
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      WHERE pr.organization_id = $1
    `;

    const params = [orgId];
    if (branch_id) {
      params.push(parseInt(branch_id, 10));
      query += ` AND pr.branch_id = $${params.length}`;
    }
    if (purchase_id) {
      params.push(parseInt(purchase_id, 10));
      query += ` AND pr.purchase_id = $${params.length}`;
    }

    query += ` ORDER BY pr.return_date DESC, pr.id DESC;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get Returns Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};