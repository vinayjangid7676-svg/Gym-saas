const crypto = require('crypto');
const db = require('../config/db');

const generateHashId = (prefix = 'sub_') => {
  const bytesNeeded = Math.ceil((32 - prefix.length) / 2);
  return (prefix + crypto.randomBytes(bytesNeeded).toString('hex')).slice(0, 32);
};

// ================================================================
// 1. GET CURRENT ACTIVE SUBSCRIPTION WITH LIVE METRICS
// ================================================================
exports.getCurrentSubscription = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;

  if (!orgId) {
    return res.status(401).json({ success: false, message: 'Organization context missing.' });
  }

  try {
    const subQuery = `
      SELECT 
        s.id AS subscription_id,
        s.hash_id AS subscription_hash,
        s.status,
        s.start_date,
        s.end_date,
        s.trial_end_date,
        s.auto_renew,
        p.id AS plan_id,
        p.hash_id AS plan_hash_id,
        p.name AS plan_name,
        p.description,
        p.monthly_price,
        p.yearly_price,
        p.max_branches,
        p.max_members,
        p.max_users,
        p.features
      FROM saas_subscriptions s
      JOIN saas_plans p ON p.id = s.plan_id
      WHERE s.organization_id = $1 AND s.status IN ('trial', 'active', 'past_due')
      ORDER BY s.id DESC
      LIMIT 1;
    `;
    const subRes = await db.query(subQuery, [orgId]);
    const currentSub = subRes.rows[0];

    if (!currentSub) {
      return res.status(404).json({ success: false, message: 'No active SaaS subscription found for this gym.' });
    }

    const branchCountRes = await db.query(
      `SELECT COUNT(id) FROM branches WHERE organization_id = $1 AND deleted_at IS NULL`,
      [orgId]
    );
    const memberCountRes = await db.query(
      `SELECT COUNT(id) FROM members WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [orgId]
    );
    const userCountRes = await db.query(
      `SELECT COUNT(id) FROM users WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [orgId]
    );

    return res.status(200).json({
      success: true,
      data: {
        subscription: {
          id: currentSub.subscription_hash,
          status: currentSub.status,
          start_date: currentSub.start_date,
          end_date: currentSub.end_date,
          trial_end_date: currentSub.trial_end_date,
          auto_renew: currentSub.auto_renew
        },
        plan: {
          id: currentSub.plan_hash_id,
          name: currentSub.plan_name,
          description: currentSub.description,
          monthly_price: currentSub.monthly_price,
          yearly_price: currentSub.yearly_price,
          features: currentSub.features,
          limits: {
            max_branches: currentSub.max_branches,
            max_members: currentSub.max_members,
            max_users: currentSub.max_users
          }
        },
        usage: {
          branches: parseInt(branchCountRes.rows[0].count, 10),
          active_members: parseInt(memberCountRes.rows[0].count, 10),
          active_users: parseInt(userCountRes.rows[0].count, 10)
        }
      }
    });
  } catch (error) {
    console.error('Subscription retrieval error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving subscription details.', error: error.message });
  }
};

// ================================================================
// 2. GET ALL AVAILABLE PLANS (For Pricing Page & Upgrade Modal)
// ================================================================
exports.getAllAvailablePlans = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT hash_id, name, description, monthly_price, yearly_price, max_branches, max_users, max_members, features 
       FROM saas_plans 
       WHERE is_active = TRUE 
       ORDER BY monthly_price ASC;`
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 3. CREATE / SEED SAAS PLAN (Super Admin Feature)
// ================================================================
exports.createSaasPlan = async (req, res) => {
  const {
    name,
    description,
    monthly_price,
    yearly_price,
    max_branches,
    max_users,
    max_members,
    features
  } = req.body;

  if (!name || monthly_price === undefined) {
    return res.status(400).json({ success: false, message: 'Plan name aur monthly price zaroori hain.' });
  }

  try {
    const hashId = generateHashId('pln_tier_');
    const query = `
      INSERT INTO saas_plans (
        hash_id, name, description, monthly_price, yearly_price,
        max_branches, max_users, max_members, features, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
      RETURNING *;
    `;
    const values = [
      hashId,
      name.trim(),
      description || null,
      parseFloat(monthly_price),
      yearly_price ? parseFloat(yearly_price) : null,
      max_branches !== undefined && max_branches !== null ? parseInt(max_branches, 10) : null,
      max_users !== undefined && max_users !== null ? parseInt(max_users, 10) : null,
      max_members !== undefined && max_members !== null ? parseInt(max_members, 10) : null,
      features ? JSON.stringify(features) : '{}'
    ];

    const { rows } = await db.query(query, values);
    return res.status(201).json({ success: true, message: 'SaaS Plan create ho gaya.', plan: rows[0] });
  } catch (error) {
    console.error('Plan creation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================================================================
// 4. SUBSCRIBE / UPGRADE TO A PLAN (Tenant Action)
// ================================================================
exports.createSubscription = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;
  const { plan_id, billing_cycle = 'monthly' } = req.body; // 'monthly' | 'yearly'

  if (!plan_id) {
    return res.status(400).json({ success: false, message: 'plan_id zaroori hai.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch Plan Details
    const planRes = await client.query(
      `SELECT * FROM saas_plans WHERE (id = $1 OR hash_id = $2) AND is_active = TRUE`,
      [isNaN(parseInt(plan_id, 10)) ? -1 : parseInt(plan_id, 10), plan_id]
    );

    if (planRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Specified SaaS Plan nahi mila ya inactive hai.' });
    }

    const selectedPlan = planRes.rows[0];

    // 2. Validate current usage before downgrading
    if (selectedPlan.max_branches !== null) {
      const branchCountRes = await client.query(
        `SELECT COUNT(id) FROM branches WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );
      const currentBranches = parseInt(branchCountRes.rows[0].count, 10);
      if (currentBranches > selectedPlan.max_branches) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Downgrade blocked: Aapke paas abhi ${currentBranches} active branches hain, jabki is plan me maximum ${selectedPlan.max_branches} allowed hain.`
        });
      }
    }

    // 3. Mark previous active subscriptions as paused/cancelled
    await client.query(
      `UPDATE saas_subscriptions 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE organization_id = $1 AND status IN ('trial', 'active', 'past_due')`,
      [orgId]
    );

    // 4. Calculate Duration
    const durationDays = billing_cycle === 'yearly' ? 365 : 30;
    const amountToBill = billing_cycle === 'yearly'
      ? (selectedPlan.yearly_price || selectedPlan.monthly_price * 10)
      : selectedPlan.monthly_price;

    const subHashId = generateHashId('sub_');
    const subQuery = `
      INSERT INTO saas_subscriptions (
        hash_id, organization_id, plan_id, status, start_date, end_date, auto_renew
      ) VALUES ($1, $2, $3, 'active', CURRENT_DATE, CURRENT_DATE + $4::int, TRUE)
      RETURNING *;
    `;
    const newSubRes = await client.query(subQuery, [subHashId, orgId, selectedPlan.id, durationDays]);
    const newSubscription = newSubRes.rows[0];

    // 5. Generate SaaS Invoice
    const invHashId = generateHashId('sinv_');
    const invoiceNumber = `SaaS-INV-${Date.now().toString().slice(-6)}`;
    const taxAmount = (Number(amountToBill) * 0.18); // 18% GST
    const totalAmount = Number(amountToBill) + taxAmount;

    await client.query(
      `INSERT INTO saas_invoices (
        hash_id, organization_id, subscription_id, invoice_number,
        amount, tax_amount, total_amount, status, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid', CURRENT_DATE + 3)`,
      [invHashId, orgId, newSubscription.id, invoiceNumber, amountToBill, taxAmount, totalAmount]
    );

    // 6. Organization Status Sync
    await client.query(
      `UPDATE organizations SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [orgId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Successfully upgraded to ${selectedPlan.name}!`,
      subscription: newSubscription,
      invoice: {
        invoice_number: invoiceNumber,
        subtotal: amountToBill,
        tax: taxAmount,
        total: totalAmount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Subscription processing failed:', error);
    return res.status(500).json({ success: false, message: 'Subscription registration failed.', error: error.message });
  } finally {
    client.release();
  }
};

// ================================================================
// 5. PAY SAAS INVOICE (Payment Gateway Callback / Mock)
// ================================================================
exports.paySaasInvoice = async (req, res) => {
  const orgId = req.orgId || req.user?.orgId;
  const { invoice_id, payment_method = 'upi_qr', gateway_transaction_id } = req.body;

  if (!invoice_id) {
    return res.status(400).json({ success: false, message: 'invoice_id zaroori hai.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const invQuery = `
      SELECT * FROM saas_invoices 
      WHERE (id = $1 OR hash_id = $2 OR invoice_number = $2) AND organization_id = $3
    `;
    const invRes = await client.query(invQuery, [
      isNaN(parseInt(invoice_id, 10)) ? -1 : parseInt(invoice_id, 10),
      invoice_id,
      orgId
    ]);

    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Invoice nahi mila.' });
    }

    const invoice = invRes.rows[0];

    // Mark invoice paid
    await client.query(
      `UPDATE saas_invoices SET status = 'paid' WHERE id = $1`,
      [invoice.id]
    );

    // Record SaaS payment log
    const payHashId = generateHashId('spay_');
    await client.query(
      `INSERT INTO saas_payments (
        hash_id, organization_id, subscription_id, invoice_id,
        amount, payment_method, gateway_transaction_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success')`,
      [
        payHashId,
        orgId,
        invoice.subscription_id,
        invoice.id,
        invoice.total_amount,
        payment_method,
        gateway_transaction_id || `TXN_${Date.now()}`
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Subscription payment successful! Service active hai.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Invoice payment error:', error);
    return res.status(500).json({ success: false, message: 'Payment processing error.', error: error.message });
  } finally {
    client.release();
  }
};