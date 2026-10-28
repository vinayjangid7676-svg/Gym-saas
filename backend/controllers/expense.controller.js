const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = '') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. EXPENSE CATEGORIES & VENDORS
// ================================================================

// Category Create
exports.createExpenseCategory = async (req, res) => {
  const orgId = req.user.orgId;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name required hai.' });
  }

  try {
    const hashId = generateHashId('exc_');
    const query = `
      INSERT INTO expense_categories (hash_id, organization_id, name)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [hashId, orgId, name.trim()]);
    return res.status(201).json({ success: true, message: 'Expense category created.', data: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Yeh category pehle se exist karti hai.' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Vendor Register
exports.createVendor = async (req, res) => {
  const orgId = req.user.orgId;
  const { name, phone, email, address, tax_id_gst } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Vendor name required hai.' });
  }

  try {
    const hashId = generateHashId('vnd_');
    const query = `
      INSERT INTO vendors (
        hash_id, organization_id, name, phone, email, address, tax_id_gst, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING *;
    `;
    const values = [hashId, orgId, name.trim(), phone || null, email || null, address || null, tax_id_gst || null];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Vendor registered successfully.', vendor: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 2. EXPENSES & VENDOR TRANSACTIONS
// ================================================================

// Record Expense (Electricity, Rent, Repairs, etc.)
exports.recordExpense = async (req, res) => {
  const client = await db.connect();
  const orgId = req.user.orgId;
  const userId = req.user.userId;

  const {
    branch_id,
    category_id,
    vendor_id,
    amount,
    expense_date,
    payment_method, // 'cash','upi_qr','pos_machine','razorpay','bank_transfer', etc.
    description,
    receipt_url,
    status = 'paid' // 'draft', 'approved', 'paid', 'cancelled'
  } = req.body;

  if (!branch_id || !amount || !expense_date) {
    return res.status(400).json({
      success: false,
      message: 'branch_id, amount aur expense_date required fields hain.'
    });
  }

  try {
    await client.query('BEGIN');

    const hashId = generateHashId('exp_');
    const expQuery = `
      INSERT INTO expenses (
        hash_id, organization_id, branch_id, category_id, vendor_id,
        amount, expense_date, payment_method, description, receipt_url,
        status, created_by, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
      RETURNING *;
    `;
    const expValues = [
      hashId, orgId, branch_id, category_id || null, vendor_id || null,
      amount, expense_date, payment_method || null, description || null,
      receipt_url || null, status, userId
    ];
    const expRes = await client.query(expQuery, expValues);
    const expense = expRes.rows[0];

    // Agar vendor associated hai aur amount paid ho chuka hai, toh vendor transaction ledger me entry karein
    if (vendor_id && status === 'paid') {
      const vtxHashId = generateHashId('vtx_');
      const vtxQuery = `
        INSERT INTO vendor_transactions (
          hash_id, vendor_id, transaction_type, amount, reference, transaction_date, notes
        ) VALUES ($1, $2, 'debit', $3, $4, $5, $6);
      `;
      await client.query(vtxQuery, [
        vtxHashId, vendor_id, amount, `EXP-${expense.id}`, expense_date, description || null
      ]);
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Expense recorded successfully.', expense });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 3. CASH REGISTERS (Daily Petty Cash / Counter Drawer)
// ================================================================

// Open Daily Cash Register
exports.openCashRegister = async (req, res) => {
  const orgId = req.user.orgId;
  const userId = req.user.userId;

  const { branch_id, register_name = 'Main Reception Counter', opening_balance = 0.00 } = req.body;

  if (!branch_id) {
    return res.status(400).json({ success: false, message: 'branch_id required hai.' });
  }

  try {
    const hashId = generateHashId('csg_');
    const query = `
      INSERT INTO cash_registers (
        hash_id, organization_id, branch_id, register_name,
        opening_balance, opened_by, opened_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *;
    `;
    const { rows } = await db.query(query, [hashId, orgId, branch_id, register_name, opening_balance, userId]);
    return res.status(201).json({ success: true, message: 'Cash register opened.', register: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Add Petty Cash Movement (Cash In / Cash Out)
exports.addCashTransaction = async (req, res) => {
  const userId = req.user.userId;
  const { register_id, transaction_type, amount, reference_type, reference_id, notes } = req.body;

  if (!register_id || !transaction_type || !amount) {
    return res.status(400).json({
      success: false,
      message: 'register_id, transaction_type (cash_in/cash_out) aur amount required hain.'
    });
  }

  try {
    const hashId = generateHashId('crt_');
    const query = `
      INSERT INTO cash_register_transactions (
        hash_id, register_id, transaction_type, amount,
        reference_type, reference_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      hashId, register_id, transaction_type, amount,
      reference_type || null, reference_id || null, notes || null, userId
    ];
    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'Cash movement logged.', transaction: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Close Cash Register at end of day
exports.closeCashRegister = async (req, res) => {
  const { register_id, closing_balance } = req.body;

  if (!register_id || closing_balance === undefined) {
    return res.status(400).json({ success: false, message: 'register_id aur closing_balance required hain.' });
  }

  try {
    const query = `
      UPDATE cash_registers
      SET closed_at = NOW(),
          closing_balance = $1
      WHERE id = $2 AND closed_at IS NULL
      RETURNING *;
    `;
    const { rows } = await db.query(query, [closing_balance, register_id]);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Register pehle se closed hai ya nahi mila.' });
    }

    return res.status(200).json({ success: true, message: 'Cash register closed successfully.', register: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. GET METHODS (Master Data & Reports)
// ================================================================

// Get all expenses with category, vendor & created_by details
exports.getExpenses = async (req, res) => {
  const orgId = req.user.orgId;
  const { branch_id, category_id, start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
        e.*,
        ec.name AS category_name,
        v.name AS vendor_name,
        u.name AS recorded_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.organization_id = $1
    `;
    const params = [orgId];

    if (branch_id) {
      params.push(parseInt(branch_id, 10));
      query += ` AND e.branch_id = $${params.length}`;
    }
    if (category_id) {
      params.push(parseInt(category_id, 10));
      query += ` AND e.category_id = $${params.length}`;
    }
    if (start_date && end_date) {
      params.push(start_date, end_date);
      query += ` AND e.expense_date BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    query += ` ORDER BY e.expense_date DESC, e.id DESC LIMIT 200;`;

    const { rows } = await db.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get categories & vendors master dropdowns
exports.getExpenseMasterData = async (req, res) => {
  const orgId = req.user.orgId;
  try {
    const [catRes, venRes] = await Promise.all([
      db.query('SELECT * FROM expense_categories WHERE organization_id = $1 ORDER BY name ASC', [orgId]),
      db.query('SELECT * FROM vendors WHERE organization_id = $1 AND is_active = TRUE ORDER BY name ASC', [orgId])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        categories: catRes.rows,
        vendors: venRes.rows
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get current active (open) cash register status & its today transactions
exports.getActiveCashRegister = async (req, res) => {
  const orgId = req.user.orgId;
  const { branch_id } = req.query;

  try {
    let regQuery = `
      SELECT cr.*, u.name AS opened_by_name
      FROM cash_registers cr
      LEFT JOIN users u ON u.id = cr.opened_by
      WHERE cr.organization_id = $1 AND cr.closed_at IS NULL
    `;
    const params = [orgId];
    if (branch_id) {
      params.push(parseInt(branch_id, 10));
      regQuery += ` AND cr.branch_id = $${params.length}`;
    }
    regQuery += ` ORDER BY cr.id DESC LIMIT 1;`;

    const regRes = await db.query(regQuery, params);
    const activeRegister = regRes.rows[0] || null;

    let movements = [];
    if (activeRegister) {
      const movRes = await db.query(
        `SELECT crt.*, u.name AS user_name 
         FROM cash_register_transactions crt
         LEFT JOIN users u ON u.id = crt.created_by
         WHERE crt.register_id = $1
         ORDER BY crt.id DESC;`,
        [activeRegister.id]
      );
      movements = movRes.rows;
    }

    return res.status(200).json({
      success: true,
      data: {
        active_register: activeRegister,
        movements
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get all active vendors for the organization
exports.getVendors = async (req, res) => {
  const orgId = req.user.orgId;
  try {
    const { rows } = await db.query(
      `SELECT * FROM vendors 
       WHERE organization_id = $1 AND is_active = TRUE 
       ORDER BY name ASC;`,
      [orgId]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};