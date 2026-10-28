'use strict';

const crypto = require('crypto');
const net = require('net');
const db = require('../config/db');
// const scheduler = require('../services/equipment.scheduler');

/* =====================================================================
 * CONSTANTS
 * ===================================================================== */
const STATUSES = ['active', 'inactive', 'under_maintenance', 'out_of_order', 'retired', 'disposed'];
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'critical'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const SEVERITIES = PRIORITIES;
const M_TYPES = ['preventive', 'corrective', 'inspection', 'calibration', 'cleaning', 'lubrication', 'safety_check', 'other'];
const PLAN_TYPES = M_TYPES.filter((t) => t !== 'corrective');
const INCIDENT_TYPES = ['breakdown', 'damage', 'malfunction', 'safety_issue', 'user_damage', 'electrical_issue', 'water_damage', 'other'];
const FAILURE_TYPES = ['breakdown', 'malfunction', 'electrical_issue', 'damage', 'water_damage'];
const INCIDENT_STATUS_UPDATES = ['investigating', 'in_progress', 'closed', 'cancelled'];
const PAYMENT_METHODS = ['cash', 'upi_qr', 'pos_machine', 'razorpay', 'stripe', 'bank_transfer', 'cheque', 'other'];
const DEPRECIATION = ['straight_line', 'none'];
const CONTRACT_TYPES = ['amc', 'warranty', 'service'];
const CONTRACT_STATUSES = ['active', 'expired', 'cancelled'];
const DOC_TYPES = ['manual', 'invoice', 'warranty', 'photo', 'other'];
const SLA_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };

const FAIL_SQL = `('breakdown','malfunction','electrical_issue','damage','water_damage')`;
const CLOSED_INC_SQL = `('resolved','closed','cancelled')`;
const OPEN_WO_SQL = `('scheduled','in_progress','overdue')`;

const HASH_RE = /^[a-z]{2,5}_[a-f0-9]{16,32}$/;

const DEFAULT_CHECKLIST = [
  'Visual inspection for damage or loose parts',
  'Check belts, cables and pulleys',
  'Lubricate moving parts',
  'Tighten bolts and fasteners',
  'Clean and sanitise surfaces',
  'Test emergency stop and safety features',
  'Verify console and display functions'
];

/* =====================================================================
 * GENERIC HELPERS
 * ===================================================================== */
const generateHashId = (prefix = '') => (prefix + crypto.randomBytes(16).toString('hex')).slice(0, 32);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message });
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'A record with this code or unique value already exists.' });
    if (err.code === '23503') return res.status(409).json({ success: false, message: 'This record is linked to other data and cannot be changed this way.' });
    if (err.code === '23514') return res.status(400).json({ success: false, message: 'One of the values is outside the allowed range.' });
    if (err.code === '22P02' || err.code === '22007') return res.status(400).json({ success: false, message: 'One of the values has an invalid format.' });
    console.error('[Equipment_Controller_Error]:', err);
    return res.status(500).json({ success: false, message: 'Internal server error processing equipment operation.' });
  }
};

const withTx = async (fn) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
};

const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const clean = (v) => (v === undefined || v === null ? null : typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v);
const toBool = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const toNum = (v, field) => {
  const c = clean(v);
  if (c === null) return null;
  const n = Number(c);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${field} must be a valid number >= 0.`);
  return n;
};
const toInt = (v, field) => {
  const n = toNum(v, field);
  if (n === null) return null;
  if (!Number.isInteger(n)) throw new HttpError(400, `${field} must be a whole number.`);
  return n;
};
const posNum = (v, field) => {
  const n = toNum(v, field);
  if (n !== null && n <= 0) throw new HttpError(400, `${field} must be greater than 0.`);
  return n;
};
const posInt = (v, field) => {
  const n = toInt(v, field);
  if (n !== null && n <= 0) throw new HttpError(400, `${field} must be greater than 0.`);
  return n;
};
const toDate = (v, field) => {
  const c = clean(v);
  if (c === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c) || Number.isNaN(Date.parse(c))) throw new HttpError(400, `${field} must be a valid date (YYYY-MM-DD).`);
  return c;
};
const toEnum = (v, allowed, field, def = null) => {
  const c = clean(v);
  if (c === null) return def;
  const l = String(c).toLowerCase();
  if (!allowed.includes(l)) throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}.`);
  return l;
};
const reqStr = (label, max = 200) => (v) => {
  const c = clean(v);
  if (!c) throw new HttpError(400, `${label} is required.`);
  if (String(c).length > max) throw new HttpError(400, `${label} is too long (max ${max} characters).`);
  return String(c);
};
const toChecklist = (v) => {
  let arr = v;
  if (typeof v === 'string') {
    try { arr = JSON.parse(v); } catch (_) { arr = v.split('\n'); }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 40);
};
const paging = (qy, def = 25, max = 200) => {
  const limit = Math.min(Math.max(parseInt(qy.limit, 10) || def, 1), max);
  const page = Math.max(parseInt(qy.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};
const buildPatch = (body, spec) => {
  const out = {};
  for (const [key, fn] of Object.entries(spec)) if (has(body, key)) out[key] = fn(body[key]);
  return out;
};
const buildFull = (body, spec) => {
  const out = {};
  for (const [key, fn] of Object.entries(spec)) out[key] = fn(body[key]);
  return out;
};

// Public output: swap internal BIGINT ids for hash ids, drop every internal FK column.
const STRIP = /(^|_)(id|by)$|^assigned_to$/;
const pub = (row) => {
  if (!row) return row;
  const o = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'hash_id' || k === 'organization_id' || k === 'total_count' || STRIP.test(k)) continue;
    o[k] = v;
  }
  if (row.hash_id) o.id = row.hash_id;
  return o;
};
const pubAll = (rows) => rows.map(pub);

const insertRow = async (q, table, data, suffix = '') => {
  const keys = Object.keys(data);
  const { rows } = await q.query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) ${suffix} RETURNING *`,
    keys.map((k) => data[k])
  );
  return rows[0];
};

const updateRow = async (q, table, id, data) => {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (!keys.length) {
    const r = await q.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return r.rows[0];
  }
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const { rows } = await q.query(
    `UPDATE ${table} SET ${sets}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => data[k]), id]
  );
  return rows[0];
};

const today = async (q) => (await q.query('SELECT CURRENT_DATE::text AS d')).rows[0].d;

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* =====================================================================
 * TENANT + BRANCH SECURITY
 * ===================================================================== */
const SOFT_DELETE_TABLES = new Set([
  'equipment', 'equipment_categories', 'equipment_maintenance', 'equipment_incidents',
  'equipment_maintenance_plans', 'equipment_spare_parts', 'equipment_contracts',
  'equipment_attachments', 'branches', 'users'
]);
const ALLOWED_TABLES = new Set([...SOFT_DELETE_TABLES, 'vendors', 'equipment_transfers']);

const resolveBy = async (q, table, hash, orgId, { lock = false, required = true, label } = {}) => {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`resolveBy: table ${table} not allowed`);
  const name = label || table;
  const h = clean(hash);
  if (h === null) {
    if (required) throw new HttpError(400, `${name} is required.`);
    return null;
  }
  if (!HASH_RE.test(String(h))) throw new HttpError(400, `Invalid ${name} reference.`);
  const { rows } = await q.query(
    `SELECT * FROM ${table} WHERE hash_id = $1 AND organization_id = $2
     ${SOFT_DELETE_TABLES.has(table) ? 'AND deleted_at IS NULL' : ''} ${lock ? 'FOR UPDATE' : ''}`,
    [h, orgId]
  );
  if (!rows.length) throw new HttpError(404, `${name} not found.`);
  return rows[0];
};

// null  => owner / unrestricted (all branches of the organisation)
// array => branch ids (strings) this user may touch
const getScope = async (req) => {
  if (req._branchScope !== undefined) return req._branchScope;
  const { orgId, userId, role } = req.user;
  if (role === 'owner' || req.user.isSuperAdmin) {
    req._branchScope = null;
    return null;
  }
  const { rows } = await db.query(
    `SELECT ub.branch_id FROM user_branches ub JOIN branches b ON b.id = ub.branch_id
      WHERE ub.user_id = $1 AND b.organization_id = $2 AND b.deleted_at IS NULL
     UNION
     SELECT sp.branch_id FROM staff_profiles sp WHERE sp.user_id = $1 AND sp.organization_id = $2`,
    [userId, orgId]
  );
  req._branchScope = rows.map((r) => String(r.branch_id));
  return req._branchScope;
};

const assertBranch = async (req, branchId) => {
  const scope = await getScope(req);
  if (scope && !scope.includes(String(branchId))) throw new HttpError(403, 'You do not have access to this branch.');
};

const getOwned = async (req, table, hash, opts = {}) => {
  const q = opts.q || db;
  const row = await resolveBy(q, table, hash, req.user.orgId, opts);
  if (row && row.branch_id) await assertBranch(req, row.branch_id);
  return row;
};

const branchFilter = async (req, branchHash) => {
  const { orgId } = req.user;
  const scope = await getScope(req);
  if (scope && scope.length === 0) throw new HttpError(403, 'No branch access has been assigned to your account.');
  const h = clean(branchHash);
  if (h && h !== 'all') {
    const b = await resolveBy(db, 'branches', h, orgId, { label: 'Branch' });
    if (scope && !scope.includes(String(b.id))) throw new HttpError(403, 'You do not have access to this branch.');
    return [String(b.id)];
  }
  return scope; // null => every branch
};

const addBranch = (ids, alias, params, where, allowNull = false) => {
  if (!ids) return;
  params.push(ids);
  const cond = `${alias}.branch_id = ANY($${params.length}::bigint[])`;
  where.push(allowNull ? `(${alias}.branch_id IS NULL OR ${cond})` : cond);
};

const auditLog = async (q, req, { branchId, action, entity, entityId, oldData = null, newData = null }) => {
  try {
    const ip = net.isIP(req.ip || '') ? req.ip : null;
    await q.query(
      `INSERT INTO audit_logs (hash_id, organization_id, user_id, branch_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        generateHashId('aud_'), req.user.orgId, req.user.userId, branchId || null, action, entity, entityId || null,
        oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null, ip, req.headers['user-agent'] || null
      ]
    );
  } catch (err) {
    console.error('[AuditLog_Err]:', err.message);
  }
};

/* =====================================================================
 * SHARED SQL FRAGMENTS + DOMAIN HELPERS
 * ===================================================================== */
const bookValueSql = (a = 'e') => `(CASE
  WHEN ${a}.depreciation_method = 'straight_line' AND COALESCE(${a}.purchase_price,0) > 0 AND ${a}.purchase_date IS NOT NULL
       AND COALESCE(${a}.expected_lifespan_years,0) > 0
  THEN GREATEST(COALESCE(${a}.salvage_value,0),
         ${a}.purchase_price - (${a}.purchase_price - COALESCE(${a}.salvage_value,0))
           * LEAST(1, ((CURRENT_DATE - ${a}.purchase_date)::numeric / 365.25) / ${a}.expected_lifespan_years))
  ELSE COALESCE(${a}.purchase_price,0) END)`;

const EQ_SELECT = `
  e.*,
  e.purchase_date::text AS purchase_date, e.invoice_date::text AS invoice_date,
  e.warranty_start_date::text AS warranty_start_date, e.warranty_end_date::text AS warranty_end_date,
  e.installation_date::text AS installation_date, e.last_maintenance_date::text AS last_maintenance_date,
  e.next_maintenance_date::text AS next_maintenance_date,
  c.hash_id AS category_hash, c.name AS category_name,
  b.hash_id AS branch_hash, b.name AS branch_name,
  v.hash_id AS vendor_hash, v.name AS vendor_name,
  ct.hash_id AS contract_hash, ct.title AS contract_title, ct.end_date::text AS contract_end_date,
  ${bookValueSql('e')}::float AS book_value,
  (e.warranty_end_date IS NOT NULL AND e.warranty_end_date < CURRENT_DATE) AS warranty_expired,
  (e.warranty_end_date IS NOT NULL AND e.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS warranty_expiring,
  (e.next_maintenance_date IS NOT NULL AND e.next_maintenance_date < CURRENT_DATE AND e.status NOT IN ('retired','disposed')) AS service_overdue,
  (SELECT COUNT(*)::int FROM equipment_incidents i WHERE i.equipment_id = e.id AND i.deleted_at IS NULL
     AND i.resolution_status NOT IN ${CLOSED_INC_SQL}) AS open_incidents`;

const EQ_FROM = `
  FROM equipment e
  JOIN branches b ON b.id = e.branch_id
  LEFT JOIN equipment_categories c ON c.id = e.category_id
  LEFT JOIN vendors v ON v.id = e.vendor_id
  LEFT JOIN equipment_contracts ct ON ct.id = e.contract_id`;

const getEquipmentRaw = async (q, id, lock = false) => {
  const { rows } = await q.query(`SELECT * FROM equipment WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0];
};

const setEquipmentState = async (q, eq, userId, { status, condition, reason, refType, refId }) => {
  const newStatus = status || eq.status;
  const newCondition = condition || eq.condition;
  if (newStatus === eq.status && newCondition === eq.condition) return eq;

  const { rows } = await q.query(
    `UPDATE equipment SET status = $1, condition = $2, updated_by = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
    [newStatus, newCondition, userId, eq.id]
  );
  await q.query(
    `INSERT INTO equipment_status_history
       (organization_id, branch_id, equipment_id, old_status, new_status, old_condition, new_condition, reason, reference_type, reference_id, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [eq.organization_id, eq.branch_id, eq.id, eq.status, newStatus, eq.condition, newCondition, reason || null, refType || null, refId || null, userId]
  );
  return rows[0];
};

// Re-derives availability from open tickets / running work orders (never leaves a machine wrongly "active")
const refreshAvailability = async (q, equipmentId, userId, { reason, refType, refId, condition } = {}) => {
  const eq = await getEquipmentRaw(q, equipmentId, true);
  if (!eq) return null;
  if (['retired', 'disposed', 'inactive'].includes(eq.status)) {
    if (condition && condition !== eq.condition) return setEquipmentState(q, eq, userId, { condition, reason, refType, refId });
    return eq;
  }
  const { rows } = await q.query(
    `SELECT
       (SELECT COUNT(*) FROM equipment_incidents WHERE equipment_id = $1 AND deleted_at IS NULL AND equipment_stopped
          AND resolution_status NOT IN ${CLOSED_INC_SQL})::int AS stopped,
       (SELECT COUNT(*) FROM equipment_maintenance WHERE equipment_id = $1 AND deleted_at IS NULL AND status = 'in_progress')::int AS wip`,
    [equipmentId]
  );
  const status = rows[0].stopped > 0 ? 'out_of_order' : rows[0].wip > 0 ? 'under_maintenance' : 'active';
  return setEquipmentState(q, eq, userId, { status, condition, reason, refType, refId });
};

const syncNextMaintenance = async (q, equipmentId, fallbackDate = null) => {
  await q.query(
    `UPDATE equipment e SET next_maintenance_date = COALESCE(
       (SELECT MIN(d) FROM (
          SELECT m.scheduled_date AS d FROM equipment_maintenance m
            WHERE m.equipment_id = e.id AND m.deleted_at IS NULL AND m.status IN ${OPEN_WO_SQL}
          UNION ALL
          SELECT pl.next_due_date FROM equipment_maintenance_plans pl
            WHERE pl.equipment_id = e.id AND pl.deleted_at IS NULL AND pl.is_active
        ) x),
       $2::date,
       CASE WHEN e.maintenance_frequency_days IS NOT NULL THEN CURRENT_DATE + e.maintenance_frequency_days END)
     WHERE e.id = $1`,
    [equipmentId, fallbackDate]
  );
};

const closeDowntime = async (q, inc) => {
  if (!inc.downtime_started_at) return 0;
  const { rows } = await q.query(
    `UPDATE equipment_incidents
       SET downtime_ended_at = NOW(),
           downtime_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - downtime_started_at)) / 60))::int
     WHERE id = $1 AND downtime_ended_at IS NULL RETURNING downtime_minutes`,
    [inc.id]
  );
  const mins = rows[0] ? rows[0].downtime_minutes || 0 : 0;
  if (mins > 0) await q.query('UPDATE equipment SET total_downtime_minutes = total_downtime_minutes + $1 WHERE id = $2', [mins, inc.equipment_id]);
  return mins;
};

const resolveIncidentTx = async (q, userId, inc, { notes, condition, rootCause = null, repairCost = null }) => {
  await closeDowntime(q, inc);
  const { rows } = await q.query(
    `UPDATE equipment_incidents
       SET resolution_status = 'resolved', resolved_at = NOW(), resolved_by = $1, resolution_notes = $2,
           root_cause = COALESCE($3, root_cause), actual_repair_cost = COALESCE($4, actual_repair_cost),
           updated_by = $1, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [userId, notes, rootCause, repairCost, inc.id]
  );
  await refreshAvailability(q, inc.equipment_id, userId, {
    condition: condition || 'good', reason: `Ticket ${inc.incident_number} resolved`, refType: 'incident', refId: inc.id
  });
  return rows[0];
};

const createPlanTx = async (q, req, eq, p) => {
  const { orgId, userId } = req.user;
  const freq = posInt(p.frequency_days, 'frequency_days');
  if (!freq) throw new HttpError(400, 'frequency_days is required.');
  const nextDue = toDate(p.first_due_date || p.next_due_date, 'first_due_date') || (await q.query('SELECT (CURRENT_DATE + $1::int)::text AS d', [freq])).rows[0].d;
  const assignee = await resolveBy(q, 'users', p.assigned_to_hash, orgId, { required: false, label: 'Assignee' });
  const vendor = await resolveBy(q, 'vendors', p.vendor_hash, orgId, { required: false, label: 'Vendor' });
  const checklist = has(p, 'checklist') ? toChecklist(p.checklist) : DEFAULT_CHECKLIST;

  return insertRow(q, 'equipment_maintenance_plans', {
    hash_id: generateHashId('eqp_'), organization_id: orgId, branch_id: eq.branch_id, equipment_id: eq.id,
    title: reqStr('Plan title')(p.title || 'Routine preventive maintenance'),
    maintenance_type: toEnum(p.maintenance_type, PLAN_TYPES, 'maintenance_type', 'preventive'),
    frequency_days: freq, lead_days: toInt(p.lead_days, 'lead_days') ?? 7, next_due_date: nextDue,
    priority: toEnum(p.priority, PRIORITIES, 'priority', 'medium'),
    estimated_cost: toNum(p.estimated_cost, 'estimated_cost') || 0,
    checklist: JSON.stringify(checklist),
    assigned_to: assignee ? assignee.id : null, vendor_id: vendor ? vendor.id : null,
    created_by: userId, updated_by: userId
  });
};

const createIncidentTx = async (q, req, eq, b) => {
  const { orgId, userId } = req.user;
  const title = reqStr('Fault summary')(b.title);
  const description = reqStr('Description', 4000)(b.description);
  const severity = toEnum(b.severity, SEVERITIES, 'severity', 'medium');
  const type = toEnum(b.incident_type, INCIDENT_TYPES, 'incident_type', 'breakdown');
  const safety = toBool(b.safety_risk);
  const stopped = toBool(b.equipment_stopped) || safety; // a safety hazard always takes the machine off the floor
  const reporter = await q.query('SELECT name FROM users WHERE id = $1', [userId]);
  const sla = new Date(Date.now() + SLA_HOURS[safety ? 'critical' : severity] * 3600 * 1000);
  const incidentNumber = `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const inc = await insertRow(q, 'equipment_incidents', {
    hash_id: generateHashId('eqi_'), organization_id: orgId, branch_id: eq.branch_id, equipment_id: eq.id,
    incident_number: incidentNumber, incident_type: type, severity, title, description,
    reported_by: userId, reported_by_name: reporter.rows[0] ? reporter.rows[0].name : 'Gym staff',
    immediate_action: clean(b.immediate_action), equipment_stopped: stopped, safety_risk: safety,
    resolution_status: 'open', downtime_started_at: stopped ? new Date() : null, sla_due_at: sla,
    created_by: userId, updated_by: userId
  });

  if (FAILURE_TYPES.includes(type)) await q.query('UPDATE equipment SET failure_count = failure_count + 1 WHERE id = $1', [eq.id]);

  if (stopped) {
    await setEquipmentState(q, eq, userId, {
      status: 'out_of_order', condition: ['poor', 'critical'].includes(eq.condition) ? eq.condition : 'poor',
      reason: `Incident: ${title}`, refType: 'incident', refId: inc.id
    });
  }

  if (toBool(b.create_work_order)) {
    const wo = await insertRow(q, 'equipment_maintenance', {
      hash_id: generateHashId('eqm_'), organization_id: orgId, branch_id: eq.branch_id, equipment_id: eq.id,
      maintenance_type: 'corrective', title: `Repair: ${title}`, description, scheduled_date: await today(q),
      status: 'scheduled', priority: safety ? 'critical' : severity, before_condition: eq.condition,
      source: 'incident', created_by: userId, updated_by: userId
    });
    await q.query(`UPDATE equipment_incidents SET maintenance_id = $1, resolution_status = 'maintenance_scheduled' WHERE id = $2`, [wo.id, inc.id]);
    inc.maintenance_id = wo.id;
    inc.resolution_status = 'maintenance_scheduled';
    await syncNextMaintenance(q, eq.id);
  }
  return inc;
};

/* =====================================================================
 * 0. LOOKUPS (dropdown data for the UI) + MANUAL SCHEDULER RUN
 * ===================================================================== */
exports.getLookups = handle(async (req, res) => {
  const { orgId, role } = req.user;
  const scope = await getScope(req);
  if (scope && scope.length === 0) throw new HttpError(403, 'No branch access has been assigned to your account.');

  const brParams = [orgId];
  const brWhere = ['b.organization_id = $1', 'b.deleted_at IS NULL', 'b.is_active = TRUE'];
  addBranch(scope, 'b', brParams, brWhere);

  const staffParams = [orgId];
  const staffWhere = ['u.organization_id = $1', 'u.deleted_at IS NULL', `u.status = 'active'`];
  addBranch(scope, 'sp', staffParams, staffWhere);

  const [branches, categories, vendors, staff] = await Promise.all([
    db.query(`SELECT b.hash_id AS id, b.name, b.code FROM branches b WHERE ${brWhere.join(' AND ')} ORDER BY b.name`, brParams),
    db.query(`SELECT hash_id AS id, name FROM equipment_categories WHERE organization_id = $1 AND deleted_at IS NULL AND is_active ORDER BY name`, [orgId]),
    db.query(`SELECT hash_id AS id, name FROM vendors WHERE organization_id = $1 AND is_active ORDER BY name`, [orgId]),
    db.query(
      `SELECT DISTINCT u.hash_id AS id, u.name FROM users u JOIN staff_profiles sp ON sp.user_id = u.id
        WHERE ${staffWhere.join(' AND ')} ORDER BY u.name`, staffParams
    )
  ]);

  res.json({
    success: true,
    role,
    can_manage: ['owner', 'manager'].includes(role),
    is_owner: role === 'owner',
    branches: branches.rows,
    categories: categories.rows,
    vendors: vendors.rows,
    staff: staff.rows
  });
});

exports.runScheduler = handle(async (req, res) => {
  const summary = await scheduler.runEquipmentScheduler({ orgId: req.user.orgId });
  res.json({ success: true, message: `Scheduler finished: ${summary.generated} work order(s) created, ${summary.overdue_marked} marked overdue.`, summary });
});

/* =====================================================================
 * 1. DASHBOARD STATS
 * ===================================================================== */
exports.getEquipmentStats = handle(async (req, res) => {
  const { orgId } = req.user;
  const ids = await branchFilter(req, req.query.branch);

  const mk = (alias, allowNull = false) => {
    const params = [orgId];
    const where = [`${alias}.organization_id = $1`];
    addBranch(ids, alias, params, where, allowNull);
    return { params, w: where.join(' AND ') };
  };
  const f = mk('e'); const i = mk('i'); const m = mk('m'); const p = mk('p'); const c = mk('c', true);
  const t = mk('m'); const top = mk('e'); const bb = mk('e');

  const [fleet, inc, mtn, trend, topFail, byBranch, parts, contracts] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE e.status NOT IN ('retired','disposed'))::int AS in_service_total,
              COUNT(*) FILTER (WHERE e.status = 'active')::int AS active,
              COUNT(*) FILTER (WHERE e.status = 'out_of_order')::int AS out_of_order,
              COUNT(*) FILTER (WHERE e.status = 'under_maintenance')::int AS under_maintenance,
              COUNT(*) FILTER (WHERE e.status = 'inactive')::int AS inactive,
              COUNT(*) FILTER (WHERE e.condition IN ('poor','critical') AND e.status NOT IN ('retired','disposed'))::int AS poor_condition,
              COUNT(*) FILTER (WHERE e.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int AS warranty_expiring,
              COUNT(*) FILTER (WHERE e.warranty_end_date < CURRENT_DATE)::int AS warranty_expired,
              COALESCE(SUM(e.purchase_price) FILTER (WHERE e.status NOT IN ('retired','disposed')), 0)::float AS asset_cost,
              COALESCE(SUM(${bookValueSql('e')}) FILTER (WHERE e.status NOT IN ('retired','disposed')), 0)::float AS book_value
       FROM equipment e WHERE ${f.w} AND e.deleted_at IS NULL`, f.params
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE i.resolution_status NOT IN ${CLOSED_INC_SQL})::int AS open_incidents,
              COUNT(*) FILTER (WHERE i.resolution_status NOT IN ${CLOSED_INC_SQL} AND i.safety_risk)::int AS safety_open,
              COUNT(*) FILTER (WHERE i.resolution_status NOT IN ${CLOSED_INC_SQL} AND i.sla_due_at < NOW())::int AS sla_breached,
              COUNT(*) FILTER (WHERE i.incident_date >= NOW() - INTERVAL '90 days' AND i.incident_type IN ${FAIL_SQL})::int AS failures_90d,
              COALESCE(SUM(i.downtime_minutes) FILTER (WHERE i.incident_date >= NOW() - INTERVAL '90 days'), 0)::int AS downtime_90d,
              COALESCE(ROUND(AVG(i.downtime_minutes) FILTER (WHERE i.resolved_at >= NOW() - INTERVAL '90 days' AND i.downtime_minutes IS NOT NULL)), 0)::int AS mttr_minutes
       FROM equipment_incidents i WHERE ${i.w} AND i.deleted_at IS NULL`, i.params
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE m.status IN ('scheduled','overdue') AND m.scheduled_date < CURRENT_DATE)::int AS overdue,
              COUNT(*) FILTER (WHERE m.status IN ('scheduled','in_progress','overdue') AND m.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::int AS due_this_week,
              COALESCE(SUM(m.actual_cost) FILTER (WHERE m.status = 'completed' AND m.completed_at >= date_trunc('month', NOW())), 0)::float AS cost_this_month,
              COUNT(*) FILTER (WHERE m.maintenance_type = 'preventive' AND m.status = 'completed' AND m.completed_at::date <= m.scheduled_date
                               AND m.scheduled_date >= CURRENT_DATE - 90)::int AS pm_on_time,
              COUNT(*) FILTER (WHERE m.maintenance_type = 'preventive' AND m.status <> 'cancelled'
                               AND m.scheduled_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE)::int AS pm_due
       FROM equipment_maintenance m WHERE ${m.w} AND m.deleted_at IS NULL`, m.params
    ),
    db.query(
      `SELECT to_char(date_trunc('month', m.completed_at), 'YYYY-MM') AS month,
              COALESCE(SUM(m.actual_cost), 0)::float AS cost, COUNT(*)::int AS jobs
       FROM equipment_maintenance m
       WHERE ${t.w} AND m.deleted_at IS NULL AND m.status = 'completed'
         AND m.completed_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
       GROUP BY 1 ORDER BY 1`, t.params
    ),
    db.query(
      `SELECT e.hash_id AS id, e.name, e.equipment_code, e.failure_count, e.total_downtime_minutes::int AS total_downtime_minutes
       FROM equipment e WHERE ${top.w} AND e.deleted_at IS NULL AND e.failure_count > 0
       ORDER BY e.failure_count DESC, e.total_downtime_minutes DESC LIMIT 5`, top.params
    ),
    db.query(
      `SELECT b.hash_id AS branch_hash, b.name AS branch_name,
              COUNT(e.id)::int AS total,
              COUNT(*) FILTER (WHERE e.status = 'active')::int AS active,
              COUNT(*) FILTER (WHERE e.status = 'out_of_order')::int AS out_of_order,
              (SELECT COUNT(*)::int FROM equipment_incidents i WHERE i.branch_id = b.id AND i.deleted_at IS NULL
                 AND i.resolution_status NOT IN ${CLOSED_INC_SQL}) AS open_incidents,
              (SELECT COUNT(*)::int FROM equipment_maintenance mm WHERE mm.branch_id = b.id AND mm.deleted_at IS NULL
                 AND mm.status IN ('scheduled','overdue') AND mm.scheduled_date < CURRENT_DATE) AS overdue_tasks
       FROM equipment e JOIN branches b ON b.id = e.branch_id
       WHERE ${bb.w} AND e.deleted_at IS NULL
       GROUP BY b.id, b.name, b.hash_id ORDER BY b.name`, bb.params
    ),
    db.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE p.quantity_on_hand <= p.reorder_level)::int AS low_stock
       FROM equipment_spare_parts p WHERE ${p.w} AND p.deleted_at IS NULL AND p.is_active`, p.params
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE c.status = 'active' AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int AS expiring_soon,
              COUNT(*) FILTER (WHERE c.status = 'active')::int AS active
       FROM equipment_contracts c WHERE ${c.w} AND c.deleted_at IS NULL`, c.params
    )
  ]);

  const f0 = fleet.rows[0]; const i0 = inc.rows[0]; const m0 = mtn.rows[0];
  const totalHours = f0.in_service_total * 90 * 24;
  const downtimeHours = i0.downtime_90d / 60;

  res.json({
    success: true,
    stats: {
      ...f0, ...i0,
      maintenance: m0,
      health_percent: f0.in_service_total ? Math.round((f0.active / f0.in_service_total) * 100) : 0,
      availability_percent: totalHours ? Math.round((1 - downtimeHours / totalHours) * 1000) / 10 : 100,
      mtbf_hours: i0.failures_90d > 0 ? Math.round((totalHours - downtimeHours) / i0.failures_90d) : null,
      pm_compliance_percent: m0.pm_due ? Math.round((m0.pm_on_time / m0.pm_due) * 100) : null,
      cost_trend: trend.rows,
      top_failing: topFail.rows,
      by_branch: byBranch.rows,
      parts: parts.rows[0],
      contracts: contracts.rows[0]
    }
  });
});

/* =====================================================================
 * 2. CATEGORIES
 * ===================================================================== */
exports.getCategories = handle(async (req, res) => {
  const { orgId } = req.user;
  const { rows } = await db.query(
    `SELECT c.*, (SELECT COUNT(*)::int FROM equipment e WHERE e.category_id = c.id AND e.deleted_at IS NULL) AS equipment_count
     FROM equipment_categories c WHERE c.organization_id = $1 AND c.deleted_at IS NULL ORDER BY c.name ASC`,
    [orgId]
  );
  res.json({ success: true, categories: pubAll(rows) });
});

exports.createCategory = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const name = reqStr('Category name', 100)(req.body.name);
  const row = await insertRow(db, 'equipment_categories', {
    hash_id: generateHashId('eqc_'), organization_id: orgId, name, description: clean(req.body.description),
    created_by: userId, updated_by: userId
  });
  res.status(201).json({ success: true, message: 'Category added.', category: pub(row) });
});

exports.updateCategory = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const cat = await resolveBy(db, 'equipment_categories', req.params.id, orgId, { label: 'Category' });
  const patch = buildPatch(req.body, { name: reqStr('Category name', 100), description: clean, is_active: toBool });
  patch.updated_by = userId;
  const row = await updateRow(db, 'equipment_categories', cat.id, patch);
  res.json({ success: true, message: 'Category updated.', category: pub(row) });
});

exports.deleteCategory = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const cat = await resolveBy(db, 'equipment_categories', req.params.id, orgId, { label: 'Category' });
  const used = await db.query('SELECT 1 FROM equipment WHERE category_id = $1 AND deleted_at IS NULL LIMIT 1', [cat.id]);
  if (used.rows.length) throw new HttpError(409, 'Cannot delete a category that still has machines. Move them first.');
  await db.query('UPDATE equipment_categories SET deleted_at = NOW(), is_active = FALSE, updated_by = $1 WHERE id = $2', [userId, cat.id]);
  res.json({ success: true, message: 'Category deleted.' });
});

/* =====================================================================
 * 3. EQUIPMENT REGISTER
 * ===================================================================== */
const EQ_SPEC = {
  name: reqStr('Machine name', 150),
  brand: clean, model: clean, serial_number: clean,
  equipment_type: (v) => clean(v) || 'cardio',
  description: clean,
  purchase_date: (v) => toDate(v, 'purchase_date'),
  purchase_price: (v) => toNum(v, 'purchase_price') ?? 0,
  supplier_name: clean, supplier_contact: clean, invoice_number: clean,
  invoice_date: (v) => toDate(v, 'invoice_date'),
  warranty_start_date: (v) => toDate(v, 'warranty_start_date'),
  warranty_end_date: (v) => toDate(v, 'warranty_end_date'),
  installation_date: (v) => toDate(v, 'installation_date'),
  location: clean,
  condition: (v) => toEnum(v, CONDITIONS, 'condition', 'good'),
  maintenance_frequency_days: (v) => posInt(v, 'maintenance_frequency_days'),
  expected_lifespan_years: (v) => posNum(v, 'expected_lifespan_years'),
  salvage_value: (v) => toNum(v, 'salvage_value') ?? 0,
  depreciation_method: (v) => toEnum(v, DEPRECIATION, 'depreciation_method', 'straight_line'),
  criticality: (v) => toEnum(v, PRIORITIES, 'criticality', 'medium'),
  current_meter_reading: (v) => toNum(v, 'current_meter_reading'),
  meter_unit: (v) => clean(v) || 'hours',
  image_url: clean,
  notes: clean
};

const assertWarrantyOrder = (d) => {
  if (d.warranty_start_date && d.warranty_end_date && d.warranty_end_date < d.warranty_start_date) {
    throw new HttpError(400, 'Warranty end date cannot be before the start date.');
  }
};

const resolveEquipmentLinks = async (q, orgId, b, { forCreate }) => {
  const out = {};
  if (forCreate || has(b, 'category_hash')) {
    const c = await resolveBy(q, 'equipment_categories', b.category_hash, orgId, { required: false, label: 'Category' });
    out.category_id = c ? c.id : null;
  }
  if (forCreate || has(b, 'vendor_hash')) {
    const v = await resolveBy(q, 'vendors', b.vendor_hash, orgId, { required: false, label: 'Vendor' });
    out.vendor_id = v ? v.id : null;
  }
  if (forCreate || has(b, 'contract_hash')) {
    const k = await resolveBy(q, 'equipment_contracts', b.contract_hash, orgId, { required: false, label: 'Contract' });
    out.contract_id = k ? k.id : null;
  }
  return out;
};

exports.getEquipmentList = handle(async (req, res) => {
  const { orgId } = req.user;
  const qy = req.query;
  const ids = await branchFilter(req, qy.branch);
  const params = [orgId];
  const where = ['e.organization_id = $1', 'e.deleted_at IS NULL'];
  addBranch(ids, 'e', params, where);

  if (clean(qy.status)) { params.push(toEnum(qy.status, STATUSES, 'status')); where.push(`e.status = $${params.length}`); }
  if (clean(qy.condition)) { params.push(toEnum(qy.condition, CONDITIONS, 'condition')); where.push(`e.condition = $${params.length}`); }
  if (clean(qy.criticality)) { params.push(toEnum(qy.criticality, PRIORITIES, 'criticality')); where.push(`e.criticality = $${params.length}`); }
  if (clean(qy.category)) {
    const cat = await resolveBy(db, 'equipment_categories', qy.category, orgId, { label: 'Category' });
    params.push(cat.id); where.push(`e.category_id = $${params.length}`);
  }
  if (clean(qy.search)) {
    params.push(`%${String(clean(qy.search)).slice(0, 80)}%`);
    const p = `$${params.length}`;
    where.push(`(e.name ILIKE ${p} OR e.equipment_code ILIKE ${p} OR e.brand ILIKE ${p} OR e.model ILIKE ${p} OR e.serial_number ILIKE ${p} OR e.location ILIKE ${p})`);
  }
  switch (clean(qy.flag)) {
    case 'service_overdue': where.push(`e.next_maintenance_date < CURRENT_DATE AND e.status NOT IN ('retired','disposed')`); break;
    case 'warranty_expiring': where.push(`e.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`); break;
    case 'warranty_expired': where.push(`e.warranty_end_date < CURRENT_DATE`); break;
    case 'poor_condition': where.push(`e.condition IN ('poor','critical') AND e.status NOT IN ('retired','disposed')`); break;
    default: break;
  }

  const SORTS = {
    created: 'e.id', code: 'e.equipment_code', name: 'e.name', status: 'e.status', condition: 'e.condition',
    next_maintenance: 'e.next_maintenance_date', purchase_date: 'e.purchase_date', failures: 'e.failure_count', value: 'e.purchase_price'
  };
  const sortCol = SORTS[clean(qy.sort)] || SORTS.created;
  const dir = String(qy.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const { limit, page, offset } = paging(qy, 25, 500);

  params.push(limit); const pl = `$${params.length}`;
  params.push(offset); const po = `$${params.length}`;

  const { rows } = await db.query(
    `SELECT ${EQ_SELECT}, COUNT(*) OVER()::int AS total_count
     ${EQ_FROM}
     WHERE ${where.join(' AND ')}
     ORDER BY ${sortCol} ${dir} NULLS LAST, e.id DESC
     LIMIT ${pl} OFFSET ${po}`,
    params
  );
  const total = rows.length ? rows[0].total_count : 0;
  res.json({ success: true, count: rows.length, total, page, limit, pages: Math.ceil(total / limit) || 1, equipment: pubAll(rows) });
});

exports.exportEquipmentCsv = handle(async (req, res) => {
  const { orgId } = req.user;
  const ids = await branchFilter(req, req.query.branch);
  const params = [orgId];
  const where = ['e.organization_id = $1', 'e.deleted_at IS NULL'];
  addBranch(ids, 'e', params, where);
  if (clean(req.query.status)) { params.push(toEnum(req.query.status, STATUSES, 'status')); where.push(`e.status = $${params.length}`); }

  const { rows } = await db.query(
    `SELECT ${EQ_SELECT} ${EQ_FROM} WHERE ${where.join(' AND ')} ORDER BY b.name, e.equipment_code LIMIT 10000`, params
  );
  const cols = [
    ['equipment_code', 'Code'], ['name', 'Name'], ['branch_name', 'Branch'], ['category_name', 'Category'], ['brand', 'Brand'],
    ['model', 'Model'], ['serial_number', 'Serial number'], ['status', 'Status'], ['condition', 'Condition'], ['criticality', 'Criticality'],
    ['location', 'Location'], ['purchase_date', 'Purchase date'], ['purchase_price', 'Purchase price'], ['book_value', 'Book value'],
    ['warranty_end_date', 'Warranty end'], ['last_maintenance_date', 'Last service'], ['next_maintenance_date', 'Next service'],
    ['failure_count', 'Failures'], ['total_downtime_minutes', 'Downtime (min)']
  ];
  const lines = [cols.map((c) => csvCell(c[1])).join(',')];
  rows.forEach((r) => lines.push(cols.map((c) => csvCell(r[c[0]])).join(',')));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="equipment-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\ufeff' + lines.join('\r\n'));
});

exports.createEquipment = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;

  const out = await withTx(async (client) => {
    const branch = await resolveBy(client, 'branches', b.branch_hash, orgId, { label: 'Branch' });
    await assertBranch(req, branch.id);

    const parsed = buildFull(b, EQ_SPEC);
    assertWarrantyOrder(parsed);
    const links = await resolveEquipmentLinks(client, orgId, b, { forCreate: true });
    const code = (clean(b.equipment_code) || `${branch.code}-${crypto.randomBytes(3).toString('hex')}`).toUpperCase();
    const status = toEnum(b.status, STATUSES, 'status', 'active');
    const freq = parsed.maintenance_frequency_days;
    const nextDate = toDate(b.next_maintenance_date, 'next_maintenance_date')
      || (freq ? (await client.query('SELECT (CURRENT_DATE + $1::int)::text AS d', [freq])).rows[0].d : null);

    const eq = await insertRow(client, 'equipment', {
      hash_id: generateHashId('eqp_'), organization_id: orgId, branch_id: branch.id, equipment_code: code,
      ...parsed, ...links, status, next_maintenance_date: nextDate,
      qr_token: crypto.randomBytes(24).toString('hex'), created_by: userId, updated_by: userId
    });

    await client.query(
      `INSERT INTO equipment_status_history (organization_id, branch_id, equipment_id, new_status, new_condition, reason, reference_type, changed_by)
       VALUES ($1,$2,$3,$4,$5,'Registered','manual',$6)`,
      [orgId, branch.id, eq.id, eq.status, eq.condition, userId]
    );

    // Auto-create the recurring preventive plan unless the caller opted out
    const wantsPlan = freq && !(has(b, 'auto_pm_plan') && !toBool(b.auto_pm_plan));
    if (wantsPlan) {
      await createPlanTx(client, req, eq, {
        title: 'Routine preventive maintenance', frequency_days: freq, first_due_date: nextDate, priority: eq.criticality === 'critical' ? 'high' : 'medium'
      });
    }
    await auditLog(client, req, { branchId: branch.id, action: 'create', entity: 'equipment', entityId: eq.id, newData: { equipment_code: code, name: eq.name } });
    return eq;
  });

  res.status(201).json({ success: true, message: 'Equipment registered successfully.', equipment: pub(out) });
});

exports.bulkImportEquipment = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const rowsIn = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rowsIn.length) throw new HttpError(400, 'No rows to import.');
  if (rowsIn.length > 500) throw new HttpError(400, 'You can import at most 500 machines at a time.');

  const result = await withTx(async (client) => {
    const branch = await resolveBy(client, 'branches', req.body.branch_hash, orgId, { label: 'Branch' });
    await assertBranch(req, branch.id);

    const catCache = new Map();
    const findCategory = async (name) => {
      const n = clean(name);
      if (!n) return null;
      const key = String(n).toLowerCase();
      if (catCache.has(key)) return catCache.get(key);
      let r = await client.query('SELECT id FROM equipment_categories WHERE organization_id = $1 AND lower(name) = $2 AND deleted_at IS NULL', [orgId, key]);
      if (!r.rows.length) {
        r = await client.query(
          `INSERT INTO equipment_categories (hash_id, organization_id, name, created_by, updated_by) VALUES ($1,$2,$3,$4,$4) RETURNING id`,
          [generateHashId('eqc_'), orgId, String(n).slice(0, 100), userId]
        );
      }
      catCache.set(key, r.rows[0].id);
      return r.rows[0].id;
    };

    const errors = []; let imported = 0; let skipped = 0;
    const seen = new Set();

    for (let idx = 0; idx < rowsIn.length; idx += 1) {
      const raw = rowsIn[idx] || {};
      try {
        const parsed = buildFull(raw, EQ_SPEC);
        assertWarrantyOrder(parsed);
        const code = (clean(raw.equipment_code) || `${branch.code}-${crypto.randomBytes(3).toString('hex')}`).toUpperCase();
        if (seen.has(code)) throw new HttpError(400, `Duplicate code ${code} inside the file.`);
        seen.add(code);
        const freq = parsed.maintenance_frequency_days;
        const nextDate = toDate(raw.next_maintenance_date, 'next_maintenance_date')
          || (freq ? (await client.query('SELECT (CURRENT_DATE + $1::int)::text AS d', [freq])).rows[0].d : null);

        const eq = await insertRow(client, 'equipment', {
          hash_id: generateHashId('eqp_'), organization_id: orgId, branch_id: branch.id, equipment_code: code,
          category_id: await findCategory(raw.category), ...parsed,
          status: 'active', next_maintenance_date: nextDate, qr_token: crypto.randomBytes(24).toString('hex'),
          created_by: userId, updated_by: userId
        }, 'ON CONFLICT (organization_id, equipment_code) WHERE deleted_at IS NULL DO NOTHING');

        if (!eq) { skipped += 1; errors.push({ row: idx + 2, message: `Code ${code} already exists - skipped.` }); continue; }
        imported += 1;
        await client.query(
          `INSERT INTO equipment_status_history (organization_id, branch_id, equipment_id, new_status, new_condition, reason, reference_type, changed_by)
           VALUES ($1,$2,$3,$4,$5,'Bulk import','import',$6)`,
          [orgId, branch.id, eq.id, eq.status, eq.condition, userId]
        );
        if (freq) await createPlanTx(client, req, eq, { title: 'Routine preventive maintenance', frequency_days: freq, first_due_date: nextDate });
      } catch (err) {
        if (err instanceof HttpError) { skipped += 1; errors.push({ row: idx + 2, message: err.message }); } else throw err;
      }
    }
    await auditLog(client, req, { branchId: branch.id, action: 'bulk_import', entity: 'equipment', newData: { imported, skipped } });
    return { imported, skipped, errors: errors.slice(0, 50) };
  });

  res.status(201).json({ success: true, message: `${result.imported} machine(s) imported, ${result.skipped} skipped.`, ...result });
});

exports.getByQr = handle(async (req, res) => {
  const { orgId } = req.user;
  const { rows } = await db.query(
    `SELECT ${EQ_SELECT} ${EQ_FROM} WHERE e.qr_token = $1 AND e.organization_id = $2 AND e.deleted_at IS NULL`,
    [req.params.token, orgId]
  );
  if (!rows.length) throw new HttpError(404, 'This QR code does not match any machine in your gym.');
  await assertBranch(req, rows[0].branch_id);
  res.json({ success: true, equipment: pub(rows[0]) });
});

exports.getEquipmentDetail = handle(async (req, res) => {
  const { orgId } = req.user;
  const eqRaw = await getOwned(req, 'equipment', req.params.id, { label: 'Equipment' });
  const id = eqRaw.id;

  const [eqRes, maint, inc, logs, hist, plans, insp, files] = await Promise.all([
    db.query(`SELECT ${EQ_SELECT} ${EQ_FROM} WHERE e.id = $1 AND e.organization_id = $2`, [id, orgId]),
    db.query(
      `SELECT em.*, em.scheduled_date::text AS scheduled_date,
              CASE WHEN em.status = 'scheduled' AND em.scheduled_date < CURRENT_DATE THEN 'overdue' ELSE em.status END AS display_status
       FROM equipment_maintenance em WHERE em.equipment_id = $1 AND em.deleted_at IS NULL
       ORDER BY em.scheduled_date DESC LIMIT 15`, [id]
    ),
    db.query(`SELECT * FROM equipment_incidents WHERE equipment_id = $1 AND deleted_at IS NULL ORDER BY incident_date DESC LIMIT 15`, [id]),
    db.query(`SELECT l.*, l.service_date::text AS service_date FROM equipment_service_logs l WHERE l.equipment_id = $1 AND l.deleted_at IS NULL ORDER BY l.service_date DESC, l.id DESC LIMIT 15`, [id]),
    db.query(
      `SELECT h.*, u.name AS changed_by_name FROM equipment_status_history h LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.equipment_id = $1 ORDER BY h.created_at DESC LIMIT 20`, [id]
    ),
    db.query(`SELECT p.*, p.next_due_date::text AS next_due_date FROM equipment_maintenance_plans p WHERE p.equipment_id = $1 AND p.deleted_at IS NULL ORDER BY p.next_due_date`, [id]),
    db.query(
      `SELECT i.*, u.name AS inspected_by_name FROM equipment_inspections i LEFT JOIN users u ON u.id = i.inspected_by
       WHERE i.equipment_id = $1 ORDER BY i.inspected_at DESC LIMIT 10`, [id]
    ),
    db.query(`SELECT * FROM equipment_attachments WHERE equipment_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [id])
  ]);

  res.json({
    success: true,
    equipment: pub(eqRes.rows[0]),
    maintenance: pubAll(maint.rows),
    incidents: pubAll(inc.rows),
    service_logs: pubAll(logs.rows),
    history: pubAll(hist.rows),
    plans: pubAll(plans.rows),
    inspections: pubAll(insp.rows),
    attachments: pubAll(files.rows)
  });
});

exports.updateEquipment = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;

  const result = await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', req.params.id, { q: client, lock: true, label: 'Equipment' });
    const patch = buildPatch(b, EQ_SPEC);
    if (has(b, 'equipment_code')) patch.equipment_code = reqStr('Equipment code', 100)(b.equipment_code).toUpperCase();
    Object.assign(patch, await resolveEquipmentLinks(client, orgId, b, { forCreate: false }));
    const cur = (await client.query('SELECT warranty_start_date::text AS s, warranty_end_date::text AS e FROM equipment WHERE id = $1', [eq.id])).rows[0];
    assertWarrantyOrder({
      warranty_start_date: has(patch, 'warranty_start_date') ? patch.warranty_start_date : cur.s,
      warranty_end_date: has(patch, 'warranty_end_date') ? patch.warranty_end_date : cur.e
    });
    patch.updated_by = userId;
    const updated = await updateRow(client, 'equipment', eq.id, patch);

    if (patch.condition && patch.condition !== eq.condition) {
      await client.query(
        `INSERT INTO equipment_status_history (organization_id, branch_id, equipment_id, old_status, new_status, old_condition, new_condition, reason, reference_type, changed_by)
         VALUES ($1,$2,$3,$4,$4,$5,$6,'Manual condition update','manual',$7)`,
        [orgId, eq.branch_id, eq.id, eq.status, eq.condition, patch.condition, userId]
      );
    }
    if (has(b, 'maintenance_frequency_days')) await syncNextMaintenance(client, eq.id);
    await auditLog(client, req, { branchId: eq.branch_id, action: 'update', entity: 'equipment', entityId: eq.id, oldData: { name: eq.name, condition: eq.condition }, newData: patch });
    return updated;
  });

  res.json({ success: true, message: 'Equipment updated.', equipment: pub(result) });
});

exports.updateEquipmentStatus = handle(async (req, res) => {
  const { userId } = req.user;
  const status = toEnum(req.body.status, STATUSES, 'status');
  if (!status) throw new HttpError(400, 'Status is required.');
  const reason = clean(req.body.reason);
  if (['retired', 'disposed'].includes(status) && !reason) throw new HttpError(400, 'Please give a reason when retiring or disposing a machine.');

  const result = await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', req.params.id, { q: client, lock: true, label: 'Equipment' });
    if (status === 'active') {
      const blocking = await client.query(
        `SELECT 1 FROM equipment_incidents WHERE equipment_id = $1 AND deleted_at IS NULL AND equipment_stopped
           AND resolution_status NOT IN ${CLOSED_INC_SQL} LIMIT 1`, [eq.id]
      );
      if (blocking.rows.length) throw new HttpError(409, 'This machine has an open breakdown ticket that took it off the floor. Resolve the ticket first.');
    }
    const updated = await setEquipmentState(client, eq, userId, { status, reason, refType: 'manual' });
    if (['retired', 'disposed'].includes(status)) {
      await client.query(`UPDATE equipment_maintenance_plans SET is_active = FALSE WHERE equipment_id = $1`, [eq.id]);
      await client.query(`UPDATE equipment SET next_maintenance_date = NULL WHERE id = $1`, [eq.id]);
    }
    await auditLog(client, req, { branchId: eq.branch_id, action: 'status_change', entity: 'equipment', entityId: eq.id, oldData: { status: eq.status }, newData: { status, reason } });
    return updated;
  });

  res.json({ success: true, message: 'Machine status updated.', equipment: pub(result) });
});

exports.deleteEquipment = handle(async (req, res) => {
  const { userId } = req.user;
  await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', req.params.id, { q: client, lock: true, label: 'Equipment' });
    const openWork = await client.query(
      `SELECT (SELECT COUNT(*) FROM equipment_incidents WHERE equipment_id = $1 AND deleted_at IS NULL AND resolution_status NOT IN ${CLOSED_INC_SQL})::int AS inc,
              (SELECT COUNT(*) FROM equipment_maintenance WHERE equipment_id = $1 AND deleted_at IS NULL AND status IN ${OPEN_WO_SQL})::int AS wo`, [eq.id]
    );
    if (openWork.rows[0].inc || openWork.rows[0].wo) {
      throw new HttpError(409, 'Close or cancel this machine\'s open tickets and work orders before removing it.');
    }
    await client.query('UPDATE equipment SET deleted_at = NOW(), updated_by = $1 WHERE id = $2', [userId, eq.id]);
    await client.query('UPDATE equipment_maintenance_plans SET is_active = FALSE, deleted_at = NOW() WHERE equipment_id = $1 AND deleted_at IS NULL', [eq.id]);
    await auditLog(client, req, { branchId: eq.branch_id, action: 'delete', entity: 'equipment', entityId: eq.id, oldData: { equipment_code: eq.equipment_code } });
  });
  res.json({ success: true, message: 'Equipment removed from the register. History is retained.' });
});

exports.addInspection = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;
  const result = toEnum(b.result, ['ok', 'issue_found'], 'result', 'ok');

  const out = await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', req.params.id, { q: client, lock: true, label: 'Equipment' });
    let incident = null;
    if (result === 'issue_found' && toBool(b.report_issue)) {
      incident = await createIncidentTx(client, req, eq, {
        title: b.title || 'Issue found during floor inspection', description: b.description || b.notes || 'Reported during a floor inspection.',
        severity: b.severity, incident_type: b.incident_type, safety_risk: b.safety_risk, equipment_stopped: b.equipment_stopped
      });
    }
    const insp = await insertRow(client, 'equipment_inspections', {
      hash_id: generateHashId('eqn_'), organization_id: orgId, branch_id: eq.branch_id, equipment_id: eq.id, result,
      checklist: JSON.stringify(Array.isArray(b.checklist) ? b.checklist : []), notes: clean(b.notes),
      incident_id: incident ? incident.id : null, inspected_by: userId
    });
    await client.query('UPDATE equipment SET last_inspected_at = NOW() WHERE id = $1', [eq.id]);
    return { insp, incident };
  });

  res.status(201).json({
    success: true,
    message: out.incident ? 'Inspection saved and breakdown ticket raised.' : 'Inspection recorded.',
    inspection: pub(out.insp), incident: out.incident ? pub(out.incident) : null
  });
});

exports.addAttachment = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;
  const eq = await getOwned(req, 'equipment', req.params.id, { label: 'Equipment' });
  const url = reqStr('File URL', 2000)(b.file_url);
  if (!/^https:\/\//i.test(url)) throw new HttpError(400, 'File URL must start with https://');
  const row = await insertRow(db, 'equipment_attachments', {
    hash_id: generateHashId('eqf_'), organization_id: orgId, branch_id: eq.branch_id, equipment_id: eq.id,
    doc_type: toEnum(b.doc_type, DOC_TYPES, 'doc_type', 'other'), file_name: reqStr('File name', 200)(b.file_name), file_url: url,
    mime_type: clean(b.mime_type), size_bytes: toInt(b.size_bytes, 'size_bytes'), uploaded_by: userId
  });
  res.status(201).json({ success: true, message: 'Document attached.', attachment: pub(row) });
});

exports.deleteAttachment = handle(async (req, res) => {
  const att = await getOwned(req, 'equipment_attachments', req.params.attId, { label: 'Attachment' });
  await db.query('UPDATE equipment_attachments SET deleted_at = NOW() WHERE id = $1', [att.id]);
  res.json({ success: true, message: 'Document removed.' });
});

/* =====================================================================
 * 4. MAINTENANCE WORK ORDERS
 * ===================================================================== */
exports.getMaintenanceList = handle(async (req, res) => {
  const { orgId } = req.user;
  const qy = req.query;
  const ids = await branchFilter(req, qy.branch);
  const params = [orgId];
  const where = ['em.organization_id = $1', 'em.deleted_at IS NULL'];
  addBranch(ids, 'em', params, where);

  const st = clean(qy.status);
  if (st === 'open') where.push(`em.status IN ${OPEN_WO_SQL}`);
  else if (st === 'overdue') where.push(`em.status IN ('scheduled','overdue') AND em.scheduled_date < CURRENT_DATE`);
  else if (st) { params.push(toEnum(st, ['scheduled', 'in_progress', 'completed', 'cancelled'], 'status')); where.push(`em.status = $${params.length}`); }

  if (clean(qy.type)) { params.push(toEnum(qy.type, M_TYPES, 'type')); where.push(`em.maintenance_type = $${params.length}`); }
  if (clean(qy.equipment)) {
    const eq = await getOwned(req, 'equipment', qy.equipment, { label: 'Equipment' });
    params.push(eq.id); where.push(`em.equipment_id = $${params.length}`);
  }
  const { limit, page, offset } = paging(qy, 50, 200);
  params.push(limit); const pl = `$${params.length}`;
  params.push(offset); const po = `$${params.length}`;

  const { rows } = await db.query(
    `SELECT em.*, em.scheduled_date::text AS scheduled_date, e.hash_id AS equipment_hash, e.name AS equipment_name, e.equipment_code,
            b.hash_id AS branch_hash, b.name AS branch_name, au.hash_id AS assignee_hash, au.name AS assignee_name,
            pl.title AS plan_title, (em.scheduled_date - CURRENT_DATE)::int AS days_until,
            CASE WHEN em.status = 'scheduled' AND em.scheduled_date < CURRENT_DATE THEN 'overdue' ELSE em.status END AS display_status,
            COUNT(*) OVER()::int AS total_count
     FROM equipment_maintenance em
     JOIN equipment e ON e.id = em.equipment_id
     JOIN branches b ON b.id = em.branch_id
     LEFT JOIN users au ON au.id = em.assigned_to
     LEFT JOIN equipment_maintenance_plans pl ON pl.id = em.plan_id
     WHERE ${where.join(' AND ')}
     ORDER BY (em.status IN ('completed','cancelled')) ASC, em.scheduled_date ASC, em.id DESC
     LIMIT ${pl} OFFSET ${po}`,
    params
  );
  const total = rows.length ? rows[0].total_count : 0;
  res.json({ success: true, total, page, limit, maintenance: pubAll(rows) });
});

exports.scheduleMaintenance = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;

  const result = await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', b.equipment_hash, { q: client, label: 'Equipment' });
    if (['retired', 'disposed'].includes(eq.status)) throw new HttpError(409, 'Cannot schedule work on a retired or disposed machine.');
    const assignee = await resolveBy(client, 'users', b.assigned_to_hash, orgId, { required: false, label: 'Assignee' });
    const vendor = await resolveBy(client, 'vendors', b.vendor_hash, orgId, { required: false, label: 'Vendor' });
    const type = toEnum(b.maintenance_type, M_TYPES, 'maintenance_type', 'preventive');

    const wo = await insertRow(client, 'equipment_maintenance', {
      hash_id: generateHashId('eqm_'), organization_id: orgId, branch_id: eq.branch_id, equipment_id: eq.id,
      maintenance_type: type, title: reqStr('Task title')(b.title), description: clean(b.description),
      scheduled_date: toDate(b.scheduled_date, 'scheduled_date') || await today(client), status: 'scheduled',
      priority: toEnum(b.priority, PRIORITIES, 'priority', 'medium'),
      assigned_to: assignee ? assignee.id : null, vendor_id: vendor ? vendor.id : null,
      vendor_name: vendor ? vendor.name : clean(b.vendor_name), technician_name: clean(b.technician_name),
      technician_contact: clean(b.technician_contact), estimated_cost: toNum(b.estimated_cost, 'estimated_cost') || 0,
      before_condition: eq.condition, checklist: JSON.stringify(has(b, 'checklist') ? toChecklist(b.checklist) : (type === 'preventive' ? DEFAULT_CHECKLIST : [])),
      source: 'manual', created_by: userId, updated_by: userId
    });

    if (clean(b.incident_hash)) {
      const inc = await getOwned(req, 'equipment_incidents', b.incident_hash, { q: client, lock: true, label: 'Incident' });
      if (String(inc.equipment_id) !== String(eq.id)) throw new HttpError(400, 'That ticket belongs to a different machine.');
      await client.query(
        `UPDATE equipment_incidents SET maintenance_id = $1, resolution_status = 'maintenance_scheduled', updated_by = $2 WHERE id = $3 AND resolution_status IN ('open','investigating')`,
        [wo.id, userId, inc.id]
      );
    }
    await syncNextMaintenance(client, eq.id);
    await auditLog(client, req, { branchId: eq.branch_id, action: 'schedule', entity: 'equipment_maintenance', entityId: wo.id, newData: { title: wo.title } });
    return wo;
  });

  res.status(201).json({ success: true, message: 'Maintenance scheduled.', maintenance: pub(result) });
});

exports.startMaintenance = handle(async (req, res) => {
  const { userId } = req.user;
  const out = await withTx(async (client) => {
    const m = await getOwned(req, 'equipment_maintenance', req.params.id, { q: client, lock: true, label: 'Work order' });
    if (!['scheduled', 'overdue'].includes(m.status)) throw new HttpError(409, `Work order is already ${m.status}.`);
    const row = await updateRow(client, 'equipment_maintenance', m.id, { status: 'in_progress', started_at: new Date(), updated_by: userId });
    await client.query(
      `UPDATE equipment_incidents SET resolution_status = 'in_progress', updated_by = $1
        WHERE maintenance_id = $2 AND resolution_status IN ('open','investigating','maintenance_scheduled')`, [userId, m.id]
    );
    await refreshAvailability(client, m.equipment_id, userId, { reason: `Work started: ${m.title}`, refType: 'maintenance', refId: m.id });
    return row;
  });
  res.json({ success: true, message: 'Work started. Machine marked under maintenance.', maintenance: pub(out) });
});

exports.completeMaintenance = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;

  const out = await withTx(async (client) => {
    const m = await getOwned(req, 'equipment_maintenance', req.params.id, { q: client, lock: true, label: 'Work order' });
    if (!['scheduled', 'in_progress', 'overdue'].includes(m.status)) throw new HttpError(409, `Work order is already ${m.status}.`);
    const eq = await getEquipmentRaw(client, m.equipment_id, true);
    const afterCondition = toEnum(b.after_condition, CONDITIONS, 'after_condition', 'good');

    // Spare parts consumed from branch inventory
    let inventoryCost = 0;
    const usedNames = [];
    const partsIn = Array.isArray(b.parts) ? b.parts : [];
    for (const pu of partsIn) {
      const qty = posNum(pu.quantity, 'part quantity');
      if (!qty) continue;
      const part = await resolveBy(client, 'equipment_spare_parts', pu.part, orgId, { lock: true, label: 'Spare part' });
      if (String(part.branch_id) !== String(m.branch_id)) throw new HttpError(400, `${part.name} belongs to a different branch.`);
      if (Number(part.quantity_on_hand) < qty) throw new HttpError(409, `Not enough stock for ${part.name} (available: ${Number(part.quantity_on_hand)}).`);
      await client.query('UPDATE equipment_spare_parts SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW() WHERE id = $2', [qty, part.id]);
      await insertRow(client, 'equipment_part_movements', {
        hash_id: generateHashId('eqv_'), organization_id: orgId, branch_id: part.branch_id, part_id: part.id,
        equipment_id: m.equipment_id, maintenance_id: m.id, movement_type: 'consume', quantity: -qty, unit_cost: part.unit_cost, created_by: userId
      });
      inventoryCost += qty * Number(part.unit_cost);
      usedNames.push(`${part.name} x${qty}`);
    }

    const labor = toNum(b.labor_cost, 'labor_cost') || 0;
    const externalParts = toNum(b.parts_cost, 'parts_cost') || 0;
    const partsCost = round2(externalParts + inventoryCost);
    const explicit = toNum(b.actual_cost, 'actual_cost');
    const actualCost = round2(explicit !== null ? explicit : labor + partsCost);

    // Auto-post expense into the gym accounts (once, guarded by the status check above)
    let expenseId = null;
    const postExpense = has(b, 'post_expense') ? toBool(b.post_expense) : true;
    if (actualCost > 0 && postExpense) {
      let cat = await client.query(`SELECT id FROM expense_categories WHERE organization_id = $1 AND name ILIKE 'Equipment%' ORDER BY id LIMIT 1`, [orgId]);
      let catId = cat.rows[0] ? cat.rows[0].id : null;
      if (!catId) {
        cat = await client.query(`INSERT INTO expense_categories (hash_id, organization_id, name) VALUES ($1,$2,'Equipment maintenance') RETURNING id`, [generateHashId('expc_'), orgId]);
        catId = cat.rows[0].id;
      }
      const markPaid = has(b, 'mark_paid') ? toBool(b.mark_paid) : true;
      const exp = await insertRow(client, 'expenses', {
        hash_id: generateHashId('exp_'), organization_id: orgId, branch_id: m.branch_id, category_id: catId, vendor_id: m.vendor_id || null,
        amount: actualCost, expense_date: await today(client), payment_method: toEnum(b.payment_method, PAYMENT_METHODS, 'payment_method', 'cash'),
        description: `Maintenance: ${eq.name} (${eq.equipment_code}) - ${m.title}`, status: markPaid ? 'paid' : 'approved', created_by: userId
      });
      expenseId = exp.id;
    }

    const partsReplaced = [clean(b.parts_replaced), ...usedNames].filter(Boolean).join('; ') || null;
    const nextDate = toDate(b.next_maintenance_date, 'next_maintenance_date');
    const meter = toNum(b.meter_reading, 'meter_reading');

    const row = await updateRow(client, 'equipment_maintenance', m.id, {
      status: 'completed', completed_at: new Date(), started_at: m.started_at || new Date(), actual_cost: actualCost,
      parts_cost: partsCost, labor_cost: labor, parts_replaced: partsReplaced, work_performed: clean(b.work_performed),
      after_condition: afterCondition, expense_id: expenseId, next_maintenance_date: nextDate,
      technician_name: clean(b.technician_name) || m.technician_name, invoice_number: clean(b.invoice_number),
      warranty_claim: toBool(b.warranty_claim), checklist_results: JSON.stringify(Array.isArray(b.checklist_results) ? b.checklist_results : []),
      meter_reading: meter, updated_by: userId
    });

    await client.query(
      `UPDATE equipment SET last_maintenance_date = CURRENT_DATE, current_meter_reading = COALESCE($1, current_meter_reading), updated_by = $2 WHERE id = $3`,
      [meter, userId, m.equipment_id]
    );

    await insertRow(client, 'equipment_service_logs', {
      hash_id: generateHashId('esl_'), organization_id: orgId, branch_id: m.branch_id, equipment_id: m.equipment_id, maintenance_id: m.id,
      service_date: await today(client),
      service_type: { corrective: 'repair', inspection: 'inspection', calibration: 'calibration' }[m.maintenance_type] || 'routine',
      service_title: m.title, service_description: clean(b.work_performed), technician_name: clean(b.technician_name) || m.technician_name,
      vendor_name: m.vendor_name, parts_used: partsReplaced, service_cost: actualCost, parts_cost: partsCost, labor_cost: labor,
      invoice_number: clean(b.invoice_number), warranty_service: toBool(b.warranty_claim), meter_reading: meter,
      condition_before: m.before_condition || eq.condition, condition_after: afterCondition, next_service_date: nextDate,
      expense_id: expenseId, created_by: userId
    });

    // Corrective work closes the linked breakdown tickets by default
    const closeLinked = has(b, 'resolve_linked_incidents') ? toBool(b.resolve_linked_incidents) : true;
    if (m.maintenance_type === 'corrective' && closeLinked) {
      const linked = await client.query(
        `SELECT * FROM equipment_incidents WHERE maintenance_id = $1 AND deleted_at IS NULL AND resolution_status NOT IN ${CLOSED_INC_SQL} FOR UPDATE`, [m.id]
      );
      for (const inc of linked.rows) {
        await resolveIncidentTx(client, userId, inc, { notes: clean(b.work_performed) || `Fixed via work order: ${m.title}`, condition: afterCondition, repairCost: actualCost });
      }
    }

    await refreshAvailability(client, m.equipment_id, userId, { condition: afterCondition, reason: `Maintenance completed: ${m.title}`, refType: 'maintenance', refId: m.id });
    await syncNextMaintenance(client, m.equipment_id, nextDate);
    await auditLog(client, req, { branchId: m.branch_id, action: 'complete', entity: 'equipment_maintenance', entityId: m.id, newData: { actualCost, expenseId } });
    return { maintenance: row, expense_posted: Boolean(expenseId) };
  });

  res.json({
    success: true,
    message: out.expense_posted ? 'Work completed and expense recorded.' : 'Work completed.',
    maintenance: pub(out.maintenance)
  });
});

exports.cancelMaintenance = handle(async (req, res) => {
  const { userId } = req.user;
  const reason = reqStr('Cancellation reason', 500)(req.body.reason);
  const out = await withTx(async (client) => {
    const m = await getOwned(req, 'equipment_maintenance', req.params.id, { q: client, lock: true, label: 'Work order' });
    if (!['scheduled', 'in_progress', 'overdue'].includes(m.status)) throw new HttpError(409, `Work order is already ${m.status}.`);
    const row = await updateRow(client, 'equipment_maintenance', m.id, { status: 'cancelled', cancel_reason: reason, updated_by: userId });
    await client.query(
      `UPDATE equipment_incidents SET maintenance_id = NULL, resolution_status = 'investigating', updated_by = $1
        WHERE maintenance_id = $2 AND resolution_status IN ('maintenance_scheduled','in_progress')`, [userId, m.id]
    );
    await refreshAvailability(client, m.equipment_id, userId, { reason: `Work order cancelled: ${m.title}`, refType: 'maintenance', refId: m.id });
    await syncNextMaintenance(client, m.equipment_id);
    return row;
  });
  res.json({ success: true, message: 'Work order cancelled.', maintenance: pub(out) });
});

/* ---------- Recurring maintenance plans ---------- */
exports.getPlans = handle(async (req, res) => {
  const { orgId } = req.user;
  const qy = req.query;
  const ids = await branchFilter(req, qy.branch);
  const params = [orgId];
  const where = ['p.organization_id = $1', 'p.deleted_at IS NULL'];
  addBranch(ids, 'p', params, where);
  if (clean(qy.equipment)) {
    const eq = await getOwned(req, 'equipment', qy.equipment, { label: 'Equipment' });
    params.push(eq.id); where.push(`p.equipment_id = $${params.length}`);
  }
  const { rows } = await db.query(
    `SELECT p.*, p.next_due_date::text AS next_due_date, e.hash_id AS equipment_hash, e.name AS equipment_name, e.equipment_code,
            b.hash_id AS branch_hash, b.name AS branch_name, au.name AS assignee_name
     FROM equipment_maintenance_plans p
     JOIN equipment e ON e.id = p.equipment_id
     JOIN branches b ON b.id = p.branch_id
     LEFT JOIN users au ON au.id = p.assigned_to
     WHERE ${where.join(' AND ')} ORDER BY p.is_active DESC, p.next_due_date ASC LIMIT 500`, params
  );
  res.json({ success: true, plans: pubAll(rows) });
});

exports.createPlan = handle(async (req, res) => {
  const out = await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', req.body.equipment_hash, { q: client, label: 'Equipment' });
    if (['retired', 'disposed'].includes(eq.status)) throw new HttpError(409, 'Cannot add a plan to a retired or disposed machine.');
    const plan = await createPlanTx(client, req, eq, req.body);
    await syncNextMaintenance(client, eq.id);
    return plan;
  });
  res.status(201).json({ success: true, message: 'Maintenance plan created. Work orders will be generated automatically.', plan: pub(out) });
});

exports.updatePlan = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;
  const out = await withTx(async (client) => {
    const plan = await getOwned(req, 'equipment_maintenance_plans', req.params.id, { q: client, lock: true, label: 'Plan' });
    const patch = buildPatch(b, {
      title: reqStr('Plan title'), frequency_days: (v) => posInt(v, 'frequency_days'), lead_days: (v) => toInt(v, 'lead_days') ?? 7,
      next_due_date: (v) => toDate(v, 'next_due_date'), priority: (v) => toEnum(v, PRIORITIES, 'priority', 'medium'),
      maintenance_type: (v) => toEnum(v, PLAN_TYPES, 'maintenance_type', 'preventive'),
      estimated_cost: (v) => toNum(v, 'estimated_cost') || 0, is_active: toBool,
      checklist: (v) => JSON.stringify(toChecklist(v))
    });
    if (has(b, 'assigned_to_hash')) { const u = await resolveBy(client, 'users', b.assigned_to_hash, orgId, { required: false, label: 'Assignee' }); patch.assigned_to = u ? u.id : null; }
    if (has(b, 'vendor_hash')) { const v = await resolveBy(client, 'vendors', b.vendor_hash, orgId, { required: false, label: 'Vendor' }); patch.vendor_id = v ? v.id : null; }
    patch.updated_by = userId;
    const row = await updateRow(client, 'equipment_maintenance_plans', plan.id, patch);
    await syncNextMaintenance(client, plan.equipment_id);
    return row;
  });
  res.json({ success: true, message: 'Plan updated.', plan: pub(out) });
});

exports.deletePlan = handle(async (req, res) => {
  const { userId } = req.user;
  await withTx(async (client) => {
    const plan = await getOwned(req, 'equipment_maintenance_plans', req.params.id, { q: client, lock: true, label: 'Plan' });
    await client.query('UPDATE equipment_maintenance_plans SET is_active = FALSE, deleted_at = NOW(), updated_by = $1 WHERE id = $2', [userId, plan.id]);
    await syncNextMaintenance(client, plan.equipment_id);
  });
  res.json({ success: true, message: 'Plan removed. Existing work orders are kept.' });
});

/* =====================================================================
 * 5. BREAKDOWN TICKETS
 * ===================================================================== */
exports.getIncidentsList = handle(async (req, res) => {
  const { orgId } = req.user;
  const qy = req.query;
  const ids = await branchFilter(req, qy.branch);
  const params = [orgId];
  const where = ['ei.organization_id = $1', 'ei.deleted_at IS NULL'];
  addBranch(ids, 'ei', params, where);

  const st = clean(qy.status);
  if (st === 'active') where.push(`ei.resolution_status NOT IN ${CLOSED_INC_SQL}`);
  else if (st) { params.push(toEnum(st, ['open', 'investigating', 'maintenance_scheduled', 'in_progress', 'resolved', 'closed', 'cancelled'], 'status')); where.push(`ei.resolution_status = $${params.length}`); }
  if (clean(qy.severity)) { params.push(toEnum(qy.severity, SEVERITIES, 'severity')); where.push(`ei.severity = $${params.length}`); }
  if (clean(qy.equipment)) {
    const eq = await getOwned(req, 'equipment', qy.equipment, { label: 'Equipment' });
    params.push(eq.id); where.push(`ei.equipment_id = $${params.length}`);
  }
  const { limit, page, offset } = paging(qy, 50, 200);
  params.push(limit); const pl = `$${params.length}`;
  params.push(offset); const po = `$${params.length}`;

  const { rows } = await db.query(
    `SELECT ei.*, e.hash_id AS equipment_hash, e.name AS equipment_name, e.equipment_code, b.hash_id AS branch_hash, b.name AS branch_name,
            au.name AS assignee_name, au.hash_id AS assignee_hash,
            (ei.resolution_status NOT IN ${CLOSED_INC_SQL} AND ei.sla_due_at IS NOT NULL AND ei.sla_due_at < NOW()) AS sla_breached,
            ROUND(EXTRACT(EPOCH FROM (COALESCE(ei.resolved_at, NOW()) - ei.incident_date)) / 60)::int AS age_minutes,
            COUNT(*) OVER()::int AS total_count
     FROM equipment_incidents ei
     JOIN equipment e ON e.id = ei.equipment_id
     JOIN branches b ON b.id = ei.branch_id
     LEFT JOIN users au ON au.id = ei.assigned_to
     WHERE ${where.join(' AND ')}
     ORDER BY (ei.resolution_status IN ${CLOSED_INC_SQL}) ASC,
              CASE ei.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, ei.incident_date DESC
     LIMIT ${pl} OFFSET ${po}`, params
  );
  const total = rows.length ? rows[0].total_count : 0;
  res.json({ success: true, total, page, limit, incidents: pubAll(rows) });
});

exports.reportIncident = handle(async (req, res) => {
  const out = await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', req.body.equipment_hash, { q: client, lock: true, label: 'Equipment' });
    if (['retired', 'disposed'].includes(eq.status)) throw new HttpError(409, 'This machine is retired or disposed.');
    const inc = await createIncidentTx(client, req, eq, req.body);
    await auditLog(client, req, { branchId: eq.branch_id, action: 'report', entity: 'equipment_incident', entityId: inc.id, newData: { title: inc.title, severity: inc.severity } });
    return inc;
  });
  res.status(201).json({ success: true, message: 'Breakdown ticket logged.', incident: pub(out) });
});

exports.updateIncidentStatus = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const status = toEnum(req.body.status, INCIDENT_STATUS_UPDATES, 'status');
  if (!status) throw new HttpError(400, 'Status is required.');

  const out = await withTx(async (client) => {
    const inc = await getOwned(req, 'equipment_incidents', req.params.id, { q: client, lock: true, label: 'Ticket' });
    const finished = ['resolved', 'closed', 'cancelled'].includes(inc.resolution_status);

    if (status === 'closed') {
      if (inc.resolution_status !== 'resolved') throw new HttpError(409, 'Only a resolved ticket can be closed.');
    } else if (finished) {
      throw new HttpError(409, `Ticket is already ${inc.resolution_status}.`);
    }

    if (status === 'cancelled') {
      await closeDowntime(client, inc);
      const row = await updateRow(client, 'equipment_incidents', inc.id, { resolution_status: 'cancelled', resolution_notes: clean(req.body.notes), updated_by: userId });
      await refreshAvailability(client, inc.equipment_id, userId, { reason: `Ticket ${inc.incident_number} cancelled`, refType: 'incident', refId: inc.id });
      return row;
    }

    const patch = { resolution_status: status, updated_by: userId };
    if (status === 'investigating') {
      patch.acknowledged_at = inc.acknowledged_at || new Date();
      patch.acknowledged_by = inc.acknowledged_by || userId;
    }
    if (has(req.body, 'assigned_to_hash')) {
      const u = await resolveBy(client, 'users', req.body.assigned_to_hash, orgId, { required: false, label: 'Assignee' });
      patch.assigned_to = u ? u.id : null;
    }
    return updateRow(client, 'equipment_incidents', inc.id, patch);
  });
  res.json({ success: true, message: 'Ticket updated.', incident: pub(out) });
});

exports.resolveIncident = handle(async (req, res) => {
  const { userId } = req.user;
  const notes = clean(req.body.resolution_notes);
  if (!notes) throw new HttpError(400, 'Please describe what was done to fix the issue.');

  const out = await withTx(async (client) => {
    const inc = await getOwned(req, 'equipment_incidents', req.params.id, { q: client, lock: true, label: 'Ticket' });
    if (['resolved', 'closed', 'cancelled'].includes(inc.resolution_status)) throw new HttpError(409, `Ticket is already ${inc.resolution_status}.`);
    const row = await resolveIncidentTx(client, userId, inc, {
      notes, condition: toEnum(req.body.condition_after, CONDITIONS, 'condition_after', 'good'),
      rootCause: clean(req.body.root_cause), repairCost: toNum(req.body.repair_cost, 'repair_cost')
    });
    await auditLog(client, req, { branchId: inc.branch_id, action: 'resolve', entity: 'equipment_incident', entityId: inc.id });
    return row;
  });
  res.json({ success: true, message: 'Ticket resolved. Machine availability updated.', incident: pub(out) });
});

/* =====================================================================
 * 6. SPARE PARTS
 * ===================================================================== */
exports.getParts = handle(async (req, res) => {
  const { orgId } = req.user;
  const qy = req.query;
  const ids = await branchFilter(req, qy.branch);
  const params = [orgId];
  const where = ['p.organization_id = $1', 'p.deleted_at IS NULL'];
  addBranch(ids, 'p', params, where);
  if (toBool(qy.low_stock)) where.push('p.quantity_on_hand <= p.reorder_level');
  if (clean(qy.search)) {
    params.push(`%${String(clean(qy.search)).slice(0, 80)}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.part_code ILIKE $${params.length})`);
  }
  const { rows } = await db.query(
    `SELECT p.*, b.hash_id AS branch_hash, b.name AS branch_name, v.hash_id AS vendor_hash, v.name AS vendor_name,
            (p.quantity_on_hand <= p.reorder_level) AS low_stock,
            (p.quantity_on_hand * p.unit_cost)::float AS stock_value
     FROM equipment_spare_parts p JOIN branches b ON b.id = p.branch_id LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE ${where.join(' AND ')} ORDER BY (p.quantity_on_hand <= p.reorder_level) DESC, p.name LIMIT 500`, params
  );
  res.json({ success: true, parts: pubAll(rows) });
});

exports.createPart = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;
  const out = await withTx(async (client) => {
    const branch = await resolveBy(client, 'branches', b.branch_hash, orgId, { label: 'Branch' });
    await assertBranch(req, branch.id);
    const vendor = await resolveBy(client, 'vendors', b.vendor_hash, orgId, { required: false, label: 'Vendor' });
    const qty = toNum(b.quantity_on_hand, 'quantity_on_hand') || 0;
    const part = await insertRow(client, 'equipment_spare_parts', {
      hash_id: generateHashId('eqs_'), organization_id: orgId, branch_id: branch.id,
      part_code: reqStr('Part code', 80)(b.part_code).toUpperCase(), name: reqStr('Part name', 150)(b.name),
      unit: clean(b.unit) || 'pcs', quantity_on_hand: qty, reorder_level: toNum(b.reorder_level, 'reorder_level') || 0,
      unit_cost: toNum(b.unit_cost, 'unit_cost') || 0, vendor_id: vendor ? vendor.id : null,
      storage_location: clean(b.storage_location), created_by: userId, updated_by: userId
    });
    if (qty > 0) {
      await insertRow(client, 'equipment_part_movements', {
        hash_id: generateHashId('eqv_'), organization_id: orgId, branch_id: branch.id, part_id: part.id,
        movement_type: 'restock', quantity: qty, unit_cost: part.unit_cost, notes: 'Opening stock', created_by: userId
      });
    }
    return part;
  });
  res.status(201).json({ success: true, message: 'Spare part added.', part: pub(out) });
});

exports.updatePart = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;
  const part = await getOwned(req, 'equipment_spare_parts', req.params.id, { label: 'Spare part' });
  const patch = buildPatch(b, {
    name: reqStr('Part name', 150), unit: (v) => clean(v) || 'pcs', reorder_level: (v) => toNum(v, 'reorder_level') || 0,
    unit_cost: (v) => toNum(v, 'unit_cost') || 0, storage_location: clean, is_active: toBool
  });
  if (has(b, 'vendor_hash')) { const v = await resolveBy(db, 'vendors', b.vendor_hash, orgId, { required: false, label: 'Vendor' }); patch.vendor_id = v ? v.id : null; }
  patch.updated_by = userId;
  const row = await updateRow(db, 'equipment_spare_parts', part.id, patch);
  res.json({ success: true, message: 'Spare part updated.', part: pub(row) });
});

exports.restockPart = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const qty = posNum(req.body.quantity, 'quantity');
  if (!qty) throw new HttpError(400, 'Quantity is required.');
  const out = await withTx(async (client) => {
    const part = await getOwned(req, 'equipment_spare_parts', req.params.id, { q: client, lock: true, label: 'Spare part' });
    const cost = toNum(req.body.unit_cost, 'unit_cost');
    const { rows } = await client.query(
      `UPDATE equipment_spare_parts SET quantity_on_hand = quantity_on_hand + $1, unit_cost = COALESCE($2, unit_cost), updated_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`, [qty, cost, userId, part.id]
    );
    await insertRow(client, 'equipment_part_movements', {
      hash_id: generateHashId('eqv_'), organization_id: orgId, branch_id: part.branch_id, part_id: part.id,
      movement_type: 'restock', quantity: qty, unit_cost: cost ?? part.unit_cost, notes: clean(req.body.notes), created_by: userId
    });
    return rows[0];
  });
  res.json({ success: true, message: 'Stock added.', part: pub(out) });
});

/* =====================================================================
 * 7. AMC / WARRANTY CONTRACTS
 * ===================================================================== */
exports.getContracts = handle(async (req, res) => {
  const { orgId } = req.user;
  const ids = await branchFilter(req, req.query.branch);
  const params = [orgId];
  const where = ['c.organization_id = $1', 'c.deleted_at IS NULL'];
  addBranch(ids, 'c', params, where, true);
  const { rows } = await db.query(
    `SELECT c.*, c.start_date::text AS start_date, c.end_date::text AS end_date, b.hash_id AS branch_hash, b.name AS branch_name,
            v.hash_id AS vendor_hash, v.name AS vendor_name,
            (c.end_date - CURRENT_DATE)::int AS days_left,
            (SELECT COUNT(*)::int FROM equipment e WHERE e.contract_id = c.id AND e.deleted_at IS NULL) AS equipment_count
     FROM equipment_contracts c LEFT JOIN branches b ON b.id = c.branch_id LEFT JOIN vendors v ON v.id = c.vendor_id
     WHERE ${where.join(' AND ')} ORDER BY (c.status <> 'active') ASC, c.end_date ASC LIMIT 300`, params
  );
  res.json({ success: true, contracts: pubAll(rows) });
});

exports.createContract = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;
  let branchId = null;
  if (clean(b.branch_hash)) { const br = await resolveBy(db, 'branches', b.branch_hash, orgId, { label: 'Branch' }); await assertBranch(req, br.id); branchId = br.id; }
  const vendor = await resolveBy(db, 'vendors', b.vendor_hash, orgId, { required: false, label: 'Vendor' });
  const start = toDate(b.start_date, 'start_date'); const end = toDate(b.end_date, 'end_date');
  if (!start || !end) throw new HttpError(400, 'Start and end dates are required.');
  if (end < start) throw new HttpError(400, 'End date cannot be before the start date.');
  const row = await insertRow(db, 'equipment_contracts', {
    hash_id: generateHashId('eqk_'), organization_id: orgId, branch_id: branchId, vendor_id: vendor ? vendor.id : null,
    contract_number: clean(b.contract_number), title: reqStr('Contract title')(b.title), contract_type: toEnum(b.contract_type, CONTRACT_TYPES, 'contract_type', 'amc'),
    start_date: start, end_date: end, annual_cost: toNum(b.annual_cost, 'annual_cost') || 0, visit_frequency_days: posInt(b.visit_frequency_days, 'visit_frequency_days'),
    coverage_notes: clean(b.coverage_notes), document_url: clean(b.document_url), created_by: userId, updated_by: userId
  });
  res.status(201).json({ success: true, message: 'Contract saved.', contract: pub(row) });
});

exports.updateContract = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const b = req.body;
  const c = await getOwned(req, 'equipment_contracts', req.params.id, { label: 'Contract' });
  const patch = buildPatch(b, {
    title: reqStr('Contract title'), contract_number: clean, contract_type: (v) => toEnum(v, CONTRACT_TYPES, 'contract_type', 'amc'),
    start_date: (v) => toDate(v, 'start_date'), end_date: (v) => toDate(v, 'end_date'), annual_cost: (v) => toNum(v, 'annual_cost') || 0,
    visit_frequency_days: (v) => posInt(v, 'visit_frequency_days'), coverage_notes: clean, document_url: clean,
    status: (v) => toEnum(v, CONTRACT_STATUSES, 'status', 'active')
  });
  if (has(b, 'vendor_hash')) { const v = await resolveBy(db, 'vendors', b.vendor_hash, orgId, { required: false, label: 'Vendor' }); patch.vendor_id = v ? v.id : null; }
  patch.updated_by = userId;
  const row = await updateRow(db, 'equipment_contracts', c.id, patch);
  res.json({ success: true, message: 'Contract updated.', contract: pub(row) });
});

exports.assignContract = handle(async (req, res) => {
  const { orgId, userId } = req.user;
  const list = Array.isArray(req.body.equipment) ? req.body.equipment.slice(0, 500) : [];
  if (!list.length) throw new HttpError(400, 'Select at least one machine.');
  const n = await withTx(async (client) => {
    const c = await getOwned(req, 'equipment_contracts', req.params.id, { q: client, lock: true, label: 'Contract' });
    let count = 0;
    for (const h of list) {
      const eq = await resolveBy(client, 'equipment', h, orgId, { label: 'Equipment' });
      await assertBranch(req, eq.branch_id);
      if (c.branch_id && String(c.branch_id) !== String(eq.branch_id)) continue; // branch-specific contract
      await client.query('UPDATE equipment SET contract_id = $1, updated_by = $2 WHERE id = $3', [c.id, userId, eq.id]);
      count += 1;
    }
    return count;
  });
  res.json({ success: true, message: `${n} machine(s) linked to this contract.` });
});

/* =====================================================================
 * 8. INTER-BRANCH TRANSFERS
 * ===================================================================== */
const applyTransfer = async (q, userId, tr, eq, notes) => {
  await q.query(`UPDATE equipment SET branch_id = $1, location = NULL, updated_by = $2, updated_at = NOW() WHERE id = $3`, [tr.to_branch_id, userId, eq.id]);
  await q.query(`UPDATE equipment_maintenance_plans SET branch_id = $1 WHERE equipment_id = $2 AND deleted_at IS NULL`, [tr.to_branch_id, eq.id]);
  await q.query(`UPDATE equipment_maintenance SET branch_id = $1 WHERE equipment_id = $2 AND deleted_at IS NULL AND status IN ${OPEN_WO_SQL}`, [tr.to_branch_id, eq.id]);
  await q.query(`UPDATE equipment_incidents SET branch_id = $1 WHERE equipment_id = $2 AND deleted_at IS NULL AND resolution_status NOT IN ${CLOSED_INC_SQL}`, [tr.to_branch_id, eq.id]);
  await q.query(
    `INSERT INTO equipment_status_history (organization_id, branch_id, equipment_id, old_status, new_status, old_condition, new_condition, reason, reference_type, reference_id, changed_by)
     VALUES ($1,$2,$3,$4,$4,$5,$5,$6,'transfer',$7,$8)`,
    [eq.organization_id, tr.to_branch_id, eq.id, eq.status, eq.condition, `Transferred between branches${notes ? `: ${notes}` : ''}`, tr.id, userId]
  );
};

exports.getTransfers = handle(async (req, res) => {
  const { orgId } = req.user;
  const ids = await branchFilter(req, req.query.branch);
  const params = [orgId];
  const where = ['t.organization_id = $1'];
  if (ids) { params.push(ids); where.push(`(t.from_branch_id = ANY($${params.length}::bigint[]) OR t.to_branch_id = ANY($${params.length}::bigint[]))`); }
  const { rows } = await db.query(
    `SELECT t.*, e.hash_id AS equipment_hash, e.name AS equipment_name, e.equipment_code,
            fb.name AS from_branch_name, tb.name AS to_branch_name, ru.name AS requested_by_name, du.name AS decided_by_name
     FROM equipment_transfers t
     JOIN equipment e ON e.id = t.equipment_id
     JOIN branches fb ON fb.id = t.from_branch_id JOIN branches tb ON tb.id = t.to_branch_id
     LEFT JOIN users ru ON ru.id = t.requested_by LEFT JOIN users du ON du.id = t.decided_by
     WHERE ${where.join(' AND ')} ORDER BY (t.status = 'pending') DESC, t.requested_at DESC LIMIT 200`, params
  );
  res.json({ success: true, transfers: pubAll(rows) });
});

exports.requestTransfer = handle(async (req, res) => {
  const { orgId, userId, role } = req.user;
  const out = await withTx(async (client) => {
    const eq = await getOwned(req, 'equipment', req.body.equipment_hash, { q: client, lock: true, label: 'Equipment' });
    const to = await resolveBy(client, 'branches', req.body.to_branch_hash, orgId, { label: 'Destination branch' });
    if (String(to.id) === String(eq.branch_id)) throw new HttpError(400, 'The machine is already in that branch.');
    if (['retired', 'disposed'].includes(eq.status)) throw new HttpError(409, 'Retired or disposed machines cannot be transferred.');
    const reason = reqStr('Reason', 500)(req.body.reason);

    const tr = await insertRow(client, 'equipment_transfers', {
      hash_id: generateHashId('eqt_'), organization_id: orgId, equipment_id: eq.id, from_branch_id: eq.branch_id, to_branch_id: to.id,
      reason, requested_by: userId
    });

    if (role === 'owner') { // owners approve their own request instantly
      await applyTransfer(client, userId, tr, eq, reason);
      const done = await updateRow(client, 'equipment_transfers', tr.id, { status: 'completed', decided_by: userId, decided_at: new Date() });
      await auditLog(client, req, { branchId: to.id, action: 'transfer', entity: 'equipment', entityId: eq.id, newData: { to: to.name } });
      return { row: done, completed: true };
    }
    return { row: tr, completed: false };
  });
  res.status(201).json({
    success: true,
    message: out.completed ? 'Machine transferred.' : 'Transfer request sent to the owner for approval.',
    transfer: pub(out.row)
  });
});

exports.decideTransfer = handle(async (req, res) => {
  const { userId } = req.user;
  const decision = toEnum(req.body.decision, ['approve', 'reject'], 'decision');
  if (!decision) throw new HttpError(400, 'Decision is required.');
  const notes = clean(req.body.notes);

  const out = await withTx(async (client) => {
    const tr = await resolveBy(client, 'equipment_transfers', req.params.id, req.user.orgId, { lock: true, label: 'Transfer' });
    if (tr.status !== 'pending') throw new HttpError(409, `This transfer is already ${tr.status}.`);
    if (decision === 'reject') {
      return updateRow(client, 'equipment_transfers', tr.id, { status: 'rejected', decided_by: userId, decided_at: new Date(), decision_notes: notes });
    }
    const eq = await getEquipmentRaw(client, tr.equipment_id, true);
    await applyTransfer(client, userId, tr, eq, notes || tr.reason);
    await auditLog(client, req, { branchId: tr.to_branch_id, action: 'transfer', entity: 'equipment', entityId: eq.id });
    return updateRow(client, 'equipment_transfers', tr.id, { status: 'completed', decided_by: userId, decided_at: new Date(), decision_notes: notes });
  });
  res.json({ success: true, message: decision === 'approve' ? 'Transfer approved and completed.' : 'Transfer rejected.', transfer: pub(out) });
});