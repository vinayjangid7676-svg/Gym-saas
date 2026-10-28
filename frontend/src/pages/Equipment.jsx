import React, { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'qrcode'; // npm i qrcode  (QR is generated locally, tokens never leave your server)
import { eqApi, getSelectedBranch, setSelectedBranch } from '../services/equipmentService';

/* =====================================================================
 * Design tokens (same dark / lime language as the rest of the dashboard)
 * ===================================================================== */
const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none transition disabled:opacity-60';
const btnPrimary = 'px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs rounded-xl transition disabled:opacity-50';
const btnGhost = 'px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs rounded-xl transition disabled:opacity-50';
const btnDanger = 'px-3.5 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition';
const btnMini = 'px-2.5 py-1 rounded-lg text-[11px] font-bold transition border';
const card = 'bg-zinc-900 border border-zinc-800 rounded-2xl';

const TONES = {
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  red: 'bg-red-500/10 text-red-400 border-red-500/30',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  blue: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};
const STATUS_TONE = {
  active: 'green', completed: 'green', resolved: 'green', approved: 'green',
  inactive: 'zinc', retired: 'zinc', disposed: 'zinc', closed: 'zinc', cancelled: 'zinc', rejected: 'zinc',
  under_maintenance: 'amber', investigating: 'amber', pending: 'amber', medium: 'amber',
  out_of_order: 'red', open: 'red', overdue: 'red', critical: 'red', high: 'red', expired: 'red',
  scheduled: 'blue', in_progress: 'blue', maintenance_scheduled: 'blue', low: 'zinc',
  excellent: 'green', good: 'green', fair: 'amber', poor: 'red',
};

const STATUS_OPTS = ['active', 'inactive', 'under_maintenance', 'out_of_order', 'retired', 'disposed'];
const COND_OPTS = ['excellent', 'good', 'fair', 'poor', 'critical'];
const PRIO_OPTS = ['low', 'medium', 'high', 'critical'];
const M_TYPES = ['preventive', 'corrective', 'inspection', 'calibration', 'cleaning', 'lubrication', 'safety_check', 'other'];
const PLAN_TYPES = M_TYPES.filter((t) => t !== 'corrective');
const INC_TYPES = ['breakdown', 'malfunction', 'electrical_issue', 'damage', 'water_damage', 'user_damage', 'safety_issue', 'other'];
const EQ_TYPES = ['cardio', 'strength', 'free_weights', 'functional', 'accessories', 'other'];
const PAY_OPTS = ['cash', 'upi_qr', 'pos_machine', 'bank_transfer', 'cheque', 'other'];
const DOC_OPTS = ['manual', 'invoice', 'warranty', 'photo', 'other'];
const INSPECT_ITEMS = ['No visible damage', 'Moves smoothly, no unusual noise', 'Safety stop and guards working', 'Display and controls working', 'Clean and ready for members'];
const FLAG_OPTS = [
  ['', 'All machines'], ['service_overdue', 'Service overdue'], ['warranty_expiring', 'Warranty expiring (30 days)'],
  ['warranty_expired', 'Warranty expired'], ['poor_condition', 'Poor condition'],
];

/* =====================================================================
 * Small helpers
 * ===================================================================== */
const cx = (...a) => a.filter(Boolean).join(' ');
const lbl = (s) => String(s ?? '').replace(/_/g, ' ');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fdate = (d) => {
  if (!d) return '—';
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fdt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const mins = (m) => {
  const n = Number(m || 0);
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  return h < 48 ? `${h} h ${n % 60} min` : `${Math.round(h / 24)} days`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);

const Badge = ({ v, tone }) => (
  <span className={cx('px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize whitespace-nowrap', TONES[tone || STATUS_TONE[v] || 'zinc'])}>
    {lbl(v)}
  </span>
);

const EnumOpts = ({ list }) => list.map((v) => <option key={v} value={v}>{lbl(v).replace(/^\w/, (c) => c.toUpperCase())}</option>);

const Field = ({ label, children, span, hint }) => (
  <label className={cx('block', span === 2 && 'col-span-2')}>
    <span className="mb-1 block text-xs font-semibold text-zinc-400">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span>}
  </label>
);
const Inp = (p) => <input {...p} className={inputCls} />;
const Sel = ({ children, ...p }) => <select {...p} className={inputCls}>{children}</select>;
const Txt = ({ rows = 3, ...p }) => <textarea rows={rows} {...p} className={inputCls} />;
const Check = ({ label, ...p }) => (
  <label className="flex items-center gap-2 text-xs text-zinc-300">
    <input type="checkbox" className="accent-lime-400" {...p} /> {label}
  </label>
);
const Grid = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

const Empty = ({ title, hint, action }) => (
  <div className="py-14 text-center">
    <p className="text-sm font-semibold text-zinc-300">{title}</p>
    {hint && <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const Pager = ({ page, pages, total, onPage }) => (
  <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
    <span>{total} machine{total === 1 ? '' : 's'}</span>
    <div className="flex items-center gap-2">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btnGhost}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={btnGhost}>Next</button>
    </div>
  </div>
);

const Kpi = ({ label, value, sub, tone = 'text-white', onClick }) => (
  <button type="button" onClick={onClick} className={cx(card, 'p-4 text-left transition', onClick && 'hover:border-zinc-600')}>
    <p className="text-xs font-semibold text-zinc-500">{label}</p>
    <p className={cx('mt-1 text-2xl font-bold', tone)}>{value}</p>
    {sub && <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>}
  </button>
);

const Th = ({ children, sortKey, sort, dir, onSort, right }) => (
  <th className={cx('px-4 py-3 font-semibold', right && 'text-right')}>
    {sortKey ? (
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-white">
        {children}{sort === sortKey && <span className="text-lime-400">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    ) : children}
  </th>
);

/* =====================================================================
 * Modal shell with built-in submit / error handling
 * ===================================================================== */
function FormModal({ title, onClose, onSubmit, onDone, submitLabel = 'Save', danger = false, wide = false, children }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setErr('');
    const res = await onSubmit(body, form);
    setBusy(false);
    if (res && res.success) onDone(res.message);
    else setErr(res?.message || 'Something went wrong. Please try again.');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className={cx(card, 'max-h-[92vh] w-full overflow-y-auto p-5', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <div className="space-y-3">{children}</div>
        {err && <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy} className={danger ? btnDanger : btnPrimary}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

/* =====================================================================
 * Utilities: CSV parsing, QR sticker, equipment options
 * ===================================================================== */
const parseCSV = (text) => {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const keys = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
};

const CSV_TEMPLATE = 'equipment_code,name,category,brand,model,serial_number,equipment_type,location,purchase_date,purchase_price,warranty_end_date,maintenance_frequency_days\n'
  + 'TRD-001,Treadmill 1,Cardio,Life Fitness,T5,SN12345,cardio,Cardio zone,2024-01-15,185000,2026-01-14,90\n';

const printSticker = async (eq) => {
  const url = `${window.location.origin}${window.location.pathname}?scan=${eq.qr_token}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 360, margin: 1 });
  const w = window.open('', '_blank', 'width=480,height=640');
  if (!w) return;
  const d = w.document;
  d.title = `Sticker ${eq.equipment_code}`;
  const wrap = d.createElement('div');
  wrap.style.cssText = 'font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:95vh;text-align:center';
  const h = d.createElement('h2'); h.style.margin = '0'; h.textContent = eq.name;
  const sub = d.createElement('p'); sub.style.cssText = 'margin:6px 0 14px;color:#555;font-weight:600'; sub.textContent = `Asset ID: ${eq.equipment_code}`;
  const img = d.createElement('img'); img.width = 240; img.style.cssText = 'border:4px solid #000;padding:8px;border-radius:12px';
  const foot = d.createElement('p'); foot.style.cssText = 'margin-top:14px;font-size:12px;color:#444'; foot.textContent = 'Scan with a staff phone to inspect or report a fault';
  wrap.append(h, sub, img, foot);
  d.body.appendChild(wrap);
  img.onload = () => w.print();
  img.src = dataUrl;
};

const useEquipmentOptions = (branch, enabled = true) => {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    eqApi.list({ branch, limit: 500, sort: 'name', dir: 'asc' }).then((r) => { if (alive && r.success) setOpts(r.equipment || []); });
    return () => { alive = false; };
  }, [branch, enabled]);
  return opts;
};

const EquipmentSelect = ({ opts, defaultValue, name = 'equipment_hash', disabled }) => (
  <Sel required name={name} defaultValue={defaultValue || ''} disabled={disabled}>
    <option value="">Select machine</option>
    {opts.filter((e) => !['retired', 'disposed'].includes(e.status) || e.id === defaultValue).map((e) => (
      <option key={e.id} value={e.id}>{e.name} ({e.equipment_code}){e.branch_name ? ` · ${e.branch_name}` : ''}</option>
    ))}
  </Sel>
);

/* =====================================================================
 * Modals
 * ===================================================================== */
function EquipmentModal({ initial, lookups, branch, onClose, onDone }) {
  const edit = Boolean(initial);
  const v = initial || {};
  const defBranch = branch !== 'all' ? branch : lookups.branches[0]?.id || '';
  return (
    <FormModal
      wide title={edit ? `Edit ${v.name}` : 'Register machine'} submitLabel={edit ? 'Save changes' : 'Register machine'}
      onClose={onClose} onDone={onDone}
      onSubmit={(body, form) => {
        if (!edit) body.auto_pm_plan = form.elements.auto_pm_plan.checked;
        return edit ? eqApi.updateEquipment(v.id, body) : eqApi.createEquipment(body);
      }}
    >
      <Grid>
        {!edit && (
          <Field label="Branch" span={2}>
            <Sel required name="branch_hash" defaultValue={defBranch}>
              {lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Sel>
          </Field>
        )}
        <Field label="Asset tag" hint={edit ? undefined : 'Leave blank to auto-generate'}><Inp name="equipment_code" defaultValue={v.equipment_code} placeholder="e.g. TRD-001" /></Field>
        <Field label="Machine name"><Inp required name="name" defaultValue={v.name} placeholder="e.g. Treadmill 1" /></Field>
        <Field label="Category">
          <Sel name="category_hash" defaultValue={v.category_hash || ''}>
            <option value="">No category</option>
            {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Sel>
        </Field>
        <Field label="Type"><Sel name="equipment_type" defaultValue={v.equipment_type || 'cardio'}><EnumOpts list={EQ_TYPES} /></Sel></Field>
        <Field label="Brand"><Inp name="brand" defaultValue={v.brand || ''} /></Field>
        <Field label="Model"><Inp name="model" defaultValue={v.model || ''} /></Field>
        <Field label="Serial number"><Inp name="serial_number" defaultValue={v.serial_number || ''} /></Field>
        <Field label="Floor location"><Inp name="location" defaultValue={v.location || ''} placeholder="e.g. Cardio zone" /></Field>
        <Field label="How critical is it?" hint="Critical machines get faster SLAs"><Sel name="criticality" defaultValue={v.criticality || 'medium'}><EnumOpts list={PRIO_OPTS} /></Sel></Field>
        <Field label="Condition"><Sel name="condition" defaultValue={v.condition || 'good'}><EnumOpts list={COND_OPTS} /></Sel></Field>
        <Field label="Purchase date"><Inp type="date" name="purchase_date" defaultValue={v.purchase_date || ''} /></Field>
        <Field label="Purchase price (₹)"><Inp type="number" min="0" step="0.01" name="purchase_price" defaultValue={v.purchase_price ?? ''} /></Field>
        <Field label="Supplier"><Inp name="supplier_name" defaultValue={v.supplier_name || ''} /></Field>
        <Field label="Service vendor">
          <Sel name="vendor_hash" defaultValue={v.vendor_hash || ''}>
            <option value="">None</option>
            {lookups.vendors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Sel>
        </Field>
        <Field label="Warranty starts"><Inp type="date" name="warranty_start_date" defaultValue={v.warranty_start_date || ''} /></Field>
        <Field label="Warranty ends"><Inp type="date" name="warranty_end_date" defaultValue={v.warranty_end_date || ''} /></Field>
        <Field label="Service every (days)" hint="Creates a recurring preventive plan"><Inp type="number" min="1" name="maintenance_frequency_days" defaultValue={v.maintenance_frequency_days ?? ''} placeholder="90" /></Field>
        <Field label="Expected life (years)"><Inp type="number" min="0.5" step="0.5" name="expected_lifespan_years" defaultValue={v.expected_lifespan_years ?? ''} placeholder="8" /></Field>
        <Field label="Salvage value (₹)" hint="Used for book value"><Inp type="number" min="0" name="salvage_value" defaultValue={v.salvage_value ?? 0} /></Field>
        <Field label="Notes" span={2}><Txt name="notes" rows={2} defaultValue={v.notes || ''} /></Field>
      </Grid>
      {!edit && <Check name="auto_pm_plan" defaultChecked label="Create the recurring preventive maintenance plan automatically" />}
    </FormModal>
  );
}

function IncidentModal({ opts, defaultEquipment, onClose, onDone }) {
  return (
    <FormModal title="Report a breakdown" submitLabel="Report issue" danger onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.reportIncident(body)}>
      <Field label="Machine"><EquipmentSelect opts={opts} defaultValue={defaultEquipment} /></Field>
      <Field label="What is wrong?"><Inp required name="title" placeholder="e.g. Belt slipping, console not powering on" /></Field>
      <Field label="Details"><Txt required name="description" placeholder="What did you see or hear? When did it start?" /></Field>
      <Grid>
        <Field label="Type"><Sel name="incident_type" defaultValue="breakdown"><EnumOpts list={INC_TYPES} /></Sel></Field>
        <Field label="Severity"><Sel name="severity" defaultValue="medium"><EnumOpts list={PRIO_OPTS} /></Sel></Field>
      </Grid>
      <Field label="Immediate action taken"><Inp name="immediate_action" placeholder="e.g. Unplugged and put a sign on it" /></Field>
      <div className="space-y-2">
        <Check name="equipment_stopped" defaultChecked label="Take it off the floor now (marks the machine out of order)" />
        <Check name="safety_risk" label="Safety risk to members (always takes it off the floor)" />
        <Check name="create_work_order" defaultChecked label="Create a repair work order" />
      </div>
    </FormModal>
  );
}

function ResolveModal({ inc, onClose, onDone }) {
  return (
    <FormModal title={`Resolve ${inc.incident_number}`} submitLabel="Resolve and restore" onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.resolveIncident(inc.id, body)}>
      <p className="text-xs text-zinc-400">{inc.equipment_name}: {inc.title}</p>
      <Field label="What was done to fix it?"><Txt required name="resolution_notes" /></Field>
      <Field label="Root cause"><Inp name="root_cause" placeholder="e.g. Worn drive belt" /></Field>
      <Grid>
        <Field label="Condition now"><Sel name="condition_after" defaultValue="good"><EnumOpts list={COND_OPTS} /></Sel></Field>
        <Field label="Repair cost (₹)"><Inp type="number" min="0" name="repair_cost" /></Field>
      </Grid>
    </FormModal>
  );
}

function IncidentStatusModal({ inc, lookups, onClose, onDone }) {
  return (
    <FormModal title={`Update ${inc.incident_number}`} onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.setIncidentStatus(inc.id, body)}>
      <Field label="Status">
        <Sel name="status" defaultValue={inc.resolution_status === 'resolved' ? 'closed' : 'investigating'}>
          <option value="investigating">Investigating</option>
          <option value="in_progress">Repair in progress</option>
          {inc.resolution_status === 'resolved' && <option value="closed">Closed</option>}
          <option value="cancelled">Cancel (false alarm)</option>
        </Sel>
      </Field>
      <Field label="Assign to">
        <Sel name="assigned_to_hash" defaultValue={inc.assignee_hash || ''}>
          <option value="">Unassigned</option>
          {lookups.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Sel>
      </Field>
      <Field label="Notes"><Txt name="notes" rows={2} /></Field>
    </FormModal>
  );
}

function ScheduleModal({ opts, lookups, defaultEquipment, onClose, onDone }) {
  return (
    <FormModal wide title="Schedule maintenance" submitLabel="Schedule task" onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.scheduleMaintenance(body)}>
      <Grid>
        <Field label="Machine" span={2}><EquipmentSelect opts={opts} defaultValue={defaultEquipment} /></Field>
        <Field label="Task" span={2}><Inp required name="title" placeholder="e.g. Motor lubrication and belt check" /></Field>
        <Field label="Type"><Sel name="maintenance_type" defaultValue="preventive"><EnumOpts list={M_TYPES} /></Sel></Field>
        <Field label="Priority"><Sel name="priority" defaultValue="medium"><EnumOpts list={PRIO_OPTS} /></Sel></Field>
        <Field label="Date"><Inp required type="date" name="scheduled_date" defaultValue={todayStr()} /></Field>
        <Field label="Estimated cost (₹)"><Inp type="number" min="0" name="estimated_cost" /></Field>
        <Field label="Assign to">
          <Sel name="assigned_to_hash" defaultValue=""><option value="">Unassigned</option>{lookups.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>
        </Field>
        <Field label="Vendor">
          <Sel name="vendor_hash" defaultValue=""><option value="">In-house</option>{lookups.vendors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>
        </Field>
        <Field label="Checklist" span={2} hint="One item per line. Leave blank to use the standard preventive checklist."><Txt name="checklist" rows={3} /></Field>
      </Grid>
    </FormModal>
  );
}

function CompleteModal({ wo, onClose, onDone }) {
  const [parts, setParts] = useState([]);
  useEffect(() => { eqApi.parts({ branch: wo.branch_hash }).then((r) => r.success && setParts(r.parts || [])); }, [wo.branch_hash]);
  const checklist = Array.isArray(wo.checklist) ? wo.checklist : [];

  return (
    <FormModal
      wide title={`Complete: ${wo.title}`} submitLabel="Mark completed" onClose={onClose} onDone={onDone}
      onSubmit={(body, form) => {
        const el = form.elements;
        body.checklist_results = checklist.map((item, i) => ({ item, ok: el[`chk_${i}`].checked }));
        body.parts = [0, 1, 2].map((i) => ({ part: body[`part_${i}`], quantity: body[`qty_${i}`] })).filter((p) => p.part && p.quantity);
        body.post_expense = el.post_expense.checked;
        body.mark_paid = el.mark_paid.checked;
        body.warranty_claim = el.warranty_claim.checked;
        if (el.resolve_linked_incidents) body.resolve_linked_incidents = el.resolve_linked_incidents.checked;
        return eqApi.completeMaintenance(wo.id, body);
      }}
    >
      <p className="text-xs text-zinc-400">{wo.equipment_name} ({wo.equipment_code})</p>
      {checklist.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="mb-2 text-xs font-semibold text-zinc-300">Checklist</p>
          <div className="space-y-1.5">
            {checklist.map((item, i) => <Check key={i} name={`chk_${i}`} defaultChecked label={item} />)}
          </div>
        </div>
      )}
      <Field label="Work performed"><Txt name="work_performed" rows={2} placeholder="What the technician did" /></Field>
      <Grid>
        <Field label="Technician"><Inp name="technician_name" defaultValue={wo.technician_name || ''} /></Field>
        <Field label="Condition after"><Sel name="after_condition" defaultValue="good"><EnumOpts list={COND_OPTS} /></Sel></Field>
        <Field label="Labour cost (₹)"><Inp type="number" min="0" name="labor_cost" /></Field>
        <Field label="Parts bought outside (₹)"><Inp type="number" min="0" name="parts_cost" /></Field>
        <Field label="Total bill override (₹)" hint="Leave blank to use labour + parts"><Inp type="number" min="0" name="actual_cost" /></Field>
        <Field label="Invoice number"><Inp name="invoice_number" /></Field>
        <Field label="Meter reading"><Inp type="number" min="0" name="meter_reading" /></Field>
        <Field label="Next service date"><Inp type="date" name="next_maintenance_date" /></Field>
      </Grid>
      {parts.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="mb-2 text-xs font-semibold text-zinc-300">Spare parts used from stock</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-2 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Sel name={`part_${i}`} defaultValue=""><option value="">Select part</option>
                  {parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({Number(p.quantity_on_hand)} {p.unit} left)</option>)}
                </Sel>
              </div>
              <Inp type="number" min="0" step="0.001" name={`qty_${i}`} placeholder="Qty" />
            </div>
          ))}
        </div>
      )}
      <Field label="Payment method"><Sel name="payment_method" defaultValue="cash"><EnumOpts list={PAY_OPTS} /></Sel></Field>
      <div className="space-y-2">
        <Check name="post_expense" defaultChecked label="Record this cost in gym expenses" />
        <Check name="mark_paid" defaultChecked label="Already paid" />
        <Check name="warranty_claim" label="Covered under warranty / AMC" />
        {wo.maintenance_type === 'corrective' && <Check name="resolve_linked_incidents" defaultChecked label="Also resolve the linked breakdown ticket" />}
      </div>
    </FormModal>
  );
}

function CancelWoModal({ wo, onClose, onDone }) {
  return (
    <FormModal title="Cancel work order" submitLabel="Cancel work order" danger onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.cancelMaintenance(wo.id, body)}>
      <p className="text-xs text-zinc-400">{wo.equipment_name}: {wo.title}</p>
      <Field label="Why is it being cancelled?"><Txt required name="reason" rows={2} /></Field>
    </FormModal>
  );
}

function PlanModal({ initial, opts, lookups, defaultEquipment, onClose, onDone }) {
  const edit = Boolean(initial);
  const v = initial || {};
  return (
    <FormModal
      wide title={edit ? 'Edit maintenance plan' : 'New recurring maintenance plan'} submitLabel={edit ? 'Save plan' : 'Create plan'} onClose={onClose} onDone={onDone}
      onSubmit={(body) => (edit ? eqApi.updatePlan(v.id, body) : eqApi.createPlan(body))}
    >
      <Grid>
        {!edit && <Field label="Machine" span={2}><EquipmentSelect opts={opts} defaultValue={defaultEquipment} /></Field>}
        <Field label="Plan name" span={2}><Inp required name="title" defaultValue={v.title || 'Routine preventive maintenance'} /></Field>
        <Field label="Type"><Sel name="maintenance_type" defaultValue={v.maintenance_type || 'preventive'}><EnumOpts list={PLAN_TYPES} /></Sel></Field>
        <Field label="Priority"><Sel name="priority" defaultValue={v.priority || 'medium'}><EnumOpts list={PRIO_OPTS} /></Sel></Field>
        <Field label="Repeat every (days)"><Inp required type="number" min="1" name="frequency_days" defaultValue={v.frequency_days || 90} /></Field>
        <Field label="Create work order ahead (days)"><Inp type="number" min="0" name="lead_days" defaultValue={v.lead_days ?? 7} /></Field>
        <Field label={edit ? 'Next due date' : 'First due date'}><Inp type="date" name={edit ? 'next_due_date' : 'first_due_date'} defaultValue={v.next_due_date || ''} /></Field>
        <Field label="Estimated cost (₹)"><Inp type="number" min="0" name="estimated_cost" defaultValue={v.estimated_cost ?? 0} /></Field>
        <Field label="Default assignee">
          <Sel name="assigned_to_hash" defaultValue=""><option value="">Unassigned</option>{lookups.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>
        </Field>
        <Field label="Vendor">
          <Sel name="vendor_hash" defaultValue=""><option value="">In-house</option>{lookups.vendors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>
        </Field>
        <Field label="Checklist" span={2} hint="One item per line. Leave blank on a new plan to use the standard checklist.">
          <Txt name="checklist" rows={4} defaultValue={Array.isArray(v.checklist) ? v.checklist.join('\n') : ''} />
        </Field>
      </Grid>
    </FormModal>
  );
}

function CategoryModal({ onClose, onDone }) {
  return (
    <FormModal title="New category" submitLabel="Add category" onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.createCategory(body)}>
      <Field label="Category name"><Inp required name="name" placeholder="e.g. Free weights" /></Field>
      <Field label="Description"><Inp name="description" /></Field>
    </FormModal>
  );
}

function PartModal({ initial, lookups, branch, onClose, onDone }) {
  const edit = Boolean(initial);
  const v = initial || {};
  const defBranch = branch !== 'all' ? branch : lookups.branches[0]?.id || '';
  return (
    <FormModal title={edit ? `Edit ${v.name}` : 'Add spare part'} submitLabel={edit ? 'Save changes' : 'Add part'} onClose={onClose} onDone={onDone}
      onSubmit={(body) => (edit ? eqApi.updatePart(v.id, body) : eqApi.createPart(body))}>
      <Grid>
        {!edit && (
          <Field label="Branch" span={2}>
            <Sel required name="branch_hash" defaultValue={defBranch}>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
          </Field>
        )}
        {!edit && <Field label="Part code"><Inp required name="part_code" placeholder="e.g. BELT-T5" /></Field>}
        <Field label="Part name" span={edit ? 2 : 1}><Inp required name="name" defaultValue={v.name || ''} placeholder="e.g. Treadmill belt" /></Field>
        <Field label="Unit"><Inp name="unit" defaultValue={v.unit || 'pcs'} /></Field>
        {!edit && <Field label="Opening stock"><Inp type="number" min="0" step="0.001" name="quantity_on_hand" defaultValue="0" /></Field>}
        <Field label="Reorder level"><Inp type="number" min="0" step="0.001" name="reorder_level" defaultValue={v.reorder_level ?? 0} /></Field>
        <Field label="Unit cost (₹)"><Inp type="number" min="0" step="0.01" name="unit_cost" defaultValue={v.unit_cost ?? 0} /></Field>
        <Field label="Supplier">
          <Sel name="vendor_hash" defaultValue={v.vendor_hash || ''}><option value="">None</option>{lookups.vendors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>
        </Field>
        <Field label="Storage location"><Inp name="storage_location" defaultValue={v.storage_location || ''} /></Field>
      </Grid>
    </FormModal>
  );
}

function RestockModal({ part, onClose, onDone }) {
  return (
    <FormModal title={`Add stock: ${part.name}`} submitLabel="Add stock" onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.restockPart(part.id, body)}>
      <p className="text-xs text-zinc-400">Currently {Number(part.quantity_on_hand)} {part.unit} in stock</p>
      <Grid>
        <Field label="Quantity received"><Inp required type="number" min="0.001" step="0.001" name="quantity" /></Field>
        <Field label="Unit cost (₹)"><Inp type="number" min="0" step="0.01" name="unit_cost" defaultValue={part.unit_cost} /></Field>
      </Grid>
      <Field label="Note"><Inp name="notes" placeholder="Invoice or supplier reference" /></Field>
    </FormModal>
  );
}

function ContractModal({ initial, lookups, branch, onClose, onDone }) {
  const edit = Boolean(initial);
  const v = initial || {};
  return (
    <FormModal wide title={edit ? 'Edit contract' : 'New AMC / warranty contract'} submitLabel={edit ? 'Save changes' : 'Save contract'} onClose={onClose} onDone={onDone}
      onSubmit={(body) => (edit ? eqApi.updateContract(v.id, body) : eqApi.createContract(body))}>
      <Grid>
        <Field label="Title" span={2}><Inp required name="title" defaultValue={v.title || ''} placeholder="e.g. Cardio AMC with FitCare Services" /></Field>
        <Field label="Type"><Sel name="contract_type" defaultValue={v.contract_type || 'amc'}><option value="amc">AMC</option><option value="warranty">Warranty</option><option value="service">Service</option></Sel></Field>
        <Field label="Contract number"><Inp name="contract_number" defaultValue={v.contract_number || ''} /></Field>
        <Field label="Vendor">
          <Sel name="vendor_hash" defaultValue={v.vendor_hash || ''}><option value="">None</option>{lookups.vendors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>
        </Field>
        {!edit && (
          <Field label="Branch" hint="Leave on 'All branches' for org-wide cover">
            <Sel name="branch_hash" defaultValue={branch !== 'all' ? branch : ''}><option value="">All branches</option>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
          </Field>
        )}
        <Field label="Starts"><Inp required type="date" name="start_date" defaultValue={v.start_date || todayStr()} /></Field>
        <Field label="Ends"><Inp required type="date" name="end_date" defaultValue={v.end_date || ''} /></Field>
        <Field label="Yearly cost (₹)"><Inp type="number" min="0" name="annual_cost" defaultValue={v.annual_cost ?? 0} /></Field>
        <Field label="Service visit every (days)"><Inp type="number" min="1" name="visit_frequency_days" defaultValue={v.visit_frequency_days ?? ''} /></Field>
        {edit && <Field label="Status"><Sel name="status" defaultValue={v.status}><option value="active">Active</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></Sel></Field>}
        <Field label="Document link (https)" span={2}><Inp name="document_url" defaultValue={v.document_url || ''} /></Field>
        <Field label="What is covered" span={2}><Txt name="coverage_notes" rows={2} defaultValue={v.coverage_notes || ''} /></Field>
      </Grid>
    </FormModal>
  );
}

function AssignContractModal({ contract, onClose, onDone }) {
  const opts = useEquipmentOptions(contract.branch_hash || 'all');
  return (
    <FormModal title={`Link machines to ${contract.title}`} submitLabel="Link selected" onClose={onClose} onDone={onDone}
      onSubmit={(body, form) => eqApi.assignContract(contract.id, { equipment: Array.from(form.querySelectorAll('input[name="eq"]:checked')).map((i) => i.value) })}>
      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3">
        {opts.length === 0 && <p className="text-xs text-zinc-500">No machines found.</p>}
        {opts.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" name="eq" value={e.id} defaultChecked={e.contract_hash === contract.id} className="accent-lime-400" />
            {e.name} ({e.equipment_code}) {e.branch_name ? `· ${e.branch_name}` : ''}
          </label>
        ))}
      </div>
    </FormModal>
  );
}

function TransferModal({ eq, lookups, onClose, onDone }) {
  return (
    <FormModal title={`Transfer ${eq.name}`} submitLabel="Request transfer" onClose={onClose} onDone={onDone}
      onSubmit={(body) => eqApi.requestTransfer({ ...body, equipment_hash: eq.id })}>
      <p className="text-xs text-zinc-400">Currently at {eq.branch_name}. Open tickets, work orders and plans move with the machine.</p>
      <Field label="Move to branch">
        <Sel required name="to_branch_hash" defaultValue="">
          <option value="">Select branch</option>
          {lookups.branches.filter((b) => b.id !== eq.branch_hash).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Sel>
      </Field>
      <Field label="Reason"><Txt required name="reason" rows={2} /></Field>
    </FormModal>
  );
}

function StatusModal({ eq, onClose, onDone }) {
  return (
    <FormModal title={`Change status: ${eq.name}`} onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.setEquipmentStatus(eq.id, body)}>
      <Field label="New status"><Sel name="status" defaultValue={eq.status}><EnumOpts list={STATUS_OPTS} /></Sel></Field>
      <Field label="Reason" hint="Required when retiring or disposing"><Txt name="reason" rows={2} /></Field>
    </FormModal>
  );
}

function InspectModal({ eq, onClose, onDone }) {
  const [result, setResult] = useState('ok');
  return (
    <FormModal title={`Inspect ${eq.name}`} submitLabel="Save inspection" onClose={onClose} onDone={onDone}
      onSubmit={(body, form) => eqApi.addInspection(eq.id, {
        result,
        checklist: INSPECT_ITEMS.map((item, i) => ({ item, ok: form.elements[`ck_${i}`].checked })),
        notes: body.notes, report_issue: result === 'issue_found', title: body.title, description: body.notes,
        severity: body.severity, safety_risk: form.elements.safety_risk?.checked, equipment_stopped: form.elements.equipment_stopped?.checked,
      })}>
      <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
        {INSPECT_ITEMS.map((item, i) => <Check key={item} name={`ck_${i}`} defaultChecked label={item} />)}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setResult('ok')} className={cx(btnMini, result === 'ok' ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-700 text-zinc-300')}>All good</button>
        <button type="button" onClick={() => setResult('issue_found')} className={cx(btnMini, result === 'issue_found' ? 'border-red-400 bg-red-500 text-white' : 'border-zinc-700 text-zinc-300')}>Issue found</button>
      </div>
      {result === 'issue_found' && (
        <>
          <Field label="What is wrong?"><Inp required name="title" /></Field>
          <Field label="Severity"><Sel name="severity" defaultValue="medium"><EnumOpts list={PRIO_OPTS} /></Sel></Field>
          <Check name="equipment_stopped" defaultChecked label="Take it off the floor" />
          <Check name="safety_risk" label="Safety risk to members" />
        </>
      )}
      <Field label="Notes"><Txt name="notes" rows={2} required={result === 'issue_found'} /></Field>
    </FormModal>
  );
}

function AttachModal({ eq, onClose, onDone }) {
  return (
    <FormModal title="Attach document" submitLabel="Attach" onClose={onClose} onDone={onDone} onSubmit={(body) => eqApi.addAttachment(eq.id, body)}>
      <Field label="Type"><Sel name="doc_type" defaultValue="manual"><EnumOpts list={DOC_OPTS} /></Sel></Field>
      <Field label="File name"><Inp required name="file_name" placeholder="e.g. Treadmill T5 manual.pdf" /></Field>
      <Field label="File link (https)"><Inp required type="url" name="file_url" placeholder="https://" /></Field>
    </FormModal>
  );
}

function ImportModal({ lookups, branch, onClose, onDone }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState(null);
  const defBranch = branch !== 'all' ? branch : lookups.branches[0]?.id || '';

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setRows(parseCSV(await f.text()));
    setReport(null);
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'equipment-import-template.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <FormModal wide title="Import machines from CSV" submitLabel={`Import ${rows.length || ''} machines`} onClose={onClose} onDone={onDone}
      onSubmit={async (body) => {
        if (!rows.length) return { success: false, message: 'Choose a CSV file with at least one machine.' };
        const res = await eqApi.bulkImport({ branch_hash: body.branch_hash, rows });
        if (res.success && res.errors?.length) { setReport(res); return { success: false, message: `${res.message} Review the notes below.` }; }
        return res;
      }}>
      <Field label="Import into branch">
        <Sel required name="branch_hash" defaultValue={defBranch}>{lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
      </Field>
      <div className="flex items-center gap-3">
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-xs text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-200" />
        <button type="button" onClick={downloadTemplate} className={btnMini + ' border-zinc-700 text-lime-400'}>Download template</button>
      </div>
      {fileName && <p className="text-xs text-zinc-400">{fileName}: {rows.length} row{rows.length === 1 ? '' : 's'} ready</p>}
      <p className="text-[11px] text-zinc-500">Required column: name. Categories are created automatically. Up to 500 machines per file. Existing asset tags are skipped.</p>
      {report?.errors?.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          {report.errors.map((er, i) => <p key={i}>Row {er.row}: {er.message}</p>)}
        </div>
      )}
    </FormModal>
  );
}

/* =====================================================================
 * Tab views
 * ===================================================================== */
function CostChart({ data }) {
  if (!data?.length) return <Empty title="No maintenance spend yet" hint="Completed work orders with a cost show up here." />;
  const max = Math.max(...data.map((d) => d.cost), 1);
  return (
    <div className="flex h-44 items-end gap-3 px-2" role="img" aria-label="Maintenance spend by month">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[11px] text-zinc-400">{inr(d.cost)}</span>
          <div className="w-full rounded-t-lg bg-lime-400" style={{ height: `${Math.max((d.cost / max) * 100, 3)}%` }} title={`${d.jobs} job(s)`} />
          <span className="text-[11px] text-zinc-500">{d.month.slice(2)}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ stats, branch, lookups, jump, openDrawer }) {
  if (!stats) return <div className={cx(card, 'p-10 text-center text-xs text-zinc-500')}>Loading analytics…</div>;
  const attention = [
    stats.sla_breached > 0 && { text: `${stats.sla_breached} ticket${stats.sla_breached > 1 ? 's' : ''} past response time`, go: () => jump('incidents') },
    stats.maintenance.overdue > 0 && { text: `${stats.maintenance.overdue} overdue service task${stats.maintenance.overdue > 1 ? 's' : ''}`, go: () => jump('maintenance') },
    stats.parts?.low_stock > 0 && { text: `${stats.parts.low_stock} spare part${stats.parts.low_stock > 1 ? 's' : ''} low on stock`, go: () => jump('parts') },
    stats.contracts?.expiring_soon > 0 && { text: `${stats.contracts.expiring_soon} contract${stats.contracts.expiring_soon > 1 ? 's' : ''} ending within 30 days`, go: () => jump('contracts') },
    stats.warranty_expiring > 0 && { text: `${stats.warranty_expiring} warrant${stats.warranty_expiring > 1 ? 'ies' : 'y'} ending within 30 days`, go: () => jump('fleet', { flag: 'warranty_expiring' }) },
    stats.poor_condition > 0 && { text: `${stats.poor_condition} machine${stats.poor_condition > 1 ? 's' : ''} in poor condition`, go: () => jump('fleet', { flag: 'poor_condition' }) },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {attention.length > 0 ? (
        <div className={cx(card, 'p-4')}>
          <p className="mb-2 text-xs font-semibold text-zinc-300">Needs attention</p>
          <div className="flex flex-wrap gap-2">
            {attention.map((a) => <button key={a.text} onClick={a.go} className={cx(btnMini, 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20')}>{a.text}</button>)}
          </div>
        </div>
      ) : (
        <div className={cx(card, 'p-4 text-xs text-emerald-400')}>Everything is on track. No overdue work, low stock or expiring cover.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cx(card, 'p-4 lg:col-span-2')}>
          <p className="mb-3 text-sm font-bold text-white">Maintenance spend, last 6 months</p>
          <CostChart data={stats.cost_trend} />
        </div>
        <div className={cx(card, 'p-4')}>
          <p className="mb-3 text-sm font-bold text-white">Reliability, last 90 days</p>
          <dl className="space-y-2.5 text-xs">
            {[
              ['Availability', `${stats.availability_percent}%`],
              ['Failures', stats.failures_90d],
              ['Mean time between failures', stats.mtbf_hours ? `${stats.mtbf_hours.toLocaleString('en-IN')} h` : 'No failures'],
              ['Mean time to repair', stats.mttr_minutes ? mins(stats.mttr_minutes) : '—'],
              ['Preventive plan compliance', stats.pm_compliance_percent === null ? '—' : `${stats.pm_compliance_percent}%`],
              ['Total downtime', mins(stats.downtime_90d)],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between border-b border-zinc-800/60 pb-2"><dt className="text-zinc-400">{k}</dt><dd className="font-semibold text-white">{val}</dd></div>
            ))}
          </dl>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cx(card, 'p-4')}>
          <p className="mb-3 text-sm font-bold text-white">Most breakdown-prone machines</p>
          {stats.top_failing.length === 0 ? <p className="text-xs text-zinc-500">No failures recorded.</p> : (
            <div className="divide-y divide-zinc-800">
              {stats.top_failing.map((m) => (
                <button key={m.id} onClick={() => openDrawer(m.id)} className="flex w-full items-center justify-between py-2.5 text-left text-xs hover:text-lime-400">
                  <span><span className="font-semibold text-white">{m.name}</span> <span className="font-mono text-zinc-500">{m.equipment_code}</span></span>
                  <span className="text-zinc-400">{m.failure_count} failures, {mins(m.total_downtime_minutes)} down</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {branch === 'all' && stats.by_branch.length > 1 && (
          <div className={cx(card, 'overflow-x-auto p-4')}>
            <p className="mb-3 text-sm font-bold text-white">Branch comparison</p>
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="text-zinc-500"><tr><th className="pb-2">Branch</th><th className="pb-2">Machines</th><th className="pb-2">Out of order</th><th className="pb-2">Open tickets</th><th className="pb-2">Overdue</th></tr></thead>
              <tbody className="divide-y divide-zinc-800/60">
                {stats.by_branch.map((b) => (
                  <tr key={b.branch_hash}>
                    <td className="py-2 font-semibold text-white">{b.branch_name}</td><td>{b.total}</td>
                    <td className={b.out_of_order ? 'text-red-400' : ''}>{b.out_of_order}</td>
                    <td className={b.open_incidents ? 'text-amber-400' : ''}>{b.open_incidents}</td>
                    <td className={b.overdue_tasks ? 'text-red-400' : ''}>{b.overdue_tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FleetTab({ data, loading, q, setQ, searchInput, setSearchInput, lookups, canManage, openDrawer, setModal }) {
  const onSort = (key) => setQ((s) => ({ ...s, sort: key, dir: s.sort === key && s.dir === 'asc' ? 'desc' : 'asc', page: 1 }));
  const list = data.equipment || [];
  const set = (k) => (e) => setQ((s) => ({ ...s, [k]: e.target.value, page: 1 }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, tag, brand, serial, location" className={cx(inputCls, 'sm:max-w-xs')} />
        <select value={q.status} onChange={set('status')} className={cx(inputCls, 'sm:w-44')}><option value="">All statuses</option><EnumOpts list={STATUS_OPTS} /></select>
        <select value={q.category} onChange={set('category')} className={cx(inputCls, 'sm:w-44')}><option value="">All categories</option>{lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={q.flag} onChange={set('flag')} className={cx(inputCls, 'sm:w-52')}>{FLAG_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <div className={cx(card, 'overflow-x-auto')}>
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-500">
            <tr>
              <Th sortKey="code" sort={q.sort} dir={q.dir} onSort={onSort}>Tag</Th>
              <Th sortKey="name" sort={q.sort} dir={q.dir} onSort={onSort}>Machine</Th>
              <Th>Branch</Th>
              <Th sortKey="status" sort={q.sort} dir={q.dir} onSort={onSort}>Status</Th>
              <Th sortKey="condition" sort={q.sort} dir={q.dir} onSort={onSort}>Condition</Th>
              <Th sortKey="next_maintenance" sort={q.sort} dir={q.dir} onSort={onSort}>Next service</Th>
              <Th>Warranty</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {list.map((e) => (
              <tr key={e.id} onClick={() => openDrawer(e.id)} className="cursor-pointer hover:bg-zinc-800/30">
                <td className="px-4 py-3 font-mono font-bold text-lime-400">{e.equipment_code}</td>
                <td className="px-4 py-3"><p className="font-semibold text-white">{e.name}</p><p className="text-[11px] text-zinc-500">{[e.brand, e.model].filter(Boolean).join(' ') || e.category_name || '—'}</p></td>
                <td className="px-4 py-3 text-zinc-400">{e.branch_name}</td>
                <td className="px-4 py-3"><Badge v={e.status} />{e.open_incidents > 0 && <span className="ml-1.5 text-[11px] text-amber-400">{e.open_incidents} open</span>}</td>
                <td className="px-4 py-3"><Badge v={e.condition} /></td>
                <td className={cx('px-4 py-3', e.service_overdue && 'font-bold text-red-400')}>{fdate(e.next_maintenance_date)}</td>
                <td className={cx('px-4 py-3', e.warranty_expired ? 'text-red-400' : e.warranty_expiring ? 'text-amber-400' : '')}>{e.warranty_end_date ? fdate(e.warranty_end_date) : '—'}</td>
                <td className="px-4 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                  <button onClick={() => printSticker(e)} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>QR sticker</button>
                  <button onClick={() => setModal({ type: 'incident', equipment: e.id })} className={cx(btnMini, 'border-red-500/30 text-red-400 hover:bg-red-500/10')}>Report fault</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && list.length === 0 && (
          <Empty title="No machines match" hint="Register your first machine, or import your whole floor from a CSV file."
            action={canManage && <div className="flex justify-center gap-2"><button className={btnPrimary} onClick={() => setModal({ type: 'equipment' })}>Register machine</button><button className={btnGhost} onClick={() => setModal({ type: 'import' })}>Import CSV</button></div>} />
        )}
        {list.length > 0 && <Pager page={data.page || 1} pages={data.pages || 1} total={data.total || 0} onPage={(p) => setQ((s) => ({ ...s, page: p }))} />}
      </div>
    </div>
  );
}

function IncidentsTab({ data, filter, setFilter, canManage, setModal, act }) {
  const list = data.incidents || [];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[['active', 'Open'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cx(btnMini, filter === k ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-700 text-zinc-300')}>{l}</button>
        ))}
      </div>
      <div className={cx(card, 'overflow-x-auto')}>
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-500">
            <tr><Th>Ticket</Th><Th>Machine</Th><Th>Fault</Th><Th>Severity</Th><Th>Status</Th><Th>Age</Th><Th right>Action</Th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {list.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-mono font-bold text-lime-400">{i.incident_number}</td>
                <td className="px-4 py-3"><p className="font-semibold text-white">{i.equipment_name}</p><p className="text-[11px] text-zinc-500">{i.branch_name}</p></td>
                <td className="px-4 py-3"><p className="text-zinc-200">{i.title}</p>{i.safety_risk && <span className="text-[11px] font-semibold text-red-400">Safety risk</span>}</td>
                <td className="px-4 py-3"><Badge v={i.severity} /></td>
                <td className="px-4 py-3"><Badge v={i.resolution_status} />{i.sla_breached && <p className="mt-1 text-[11px] font-semibold text-red-400">Past response time</p>}{i.assignee_name && <p className="mt-1 text-[11px] text-zinc-500">{i.assignee_name}</p>}</td>
                <td className="px-4 py-3 text-zinc-400">{mins(i.age_minutes)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canManage && !['resolved', 'closed', 'cancelled'].includes(i.resolution_status) && (
                    <>
                      <button onClick={() => setModal({ type: 'incident-status', inc: i })} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>Update</button>
                      {!i.maintenance_id && <button onClick={() => setModal({ type: 'schedule', equipment: i.equipment_hash, incident: i.id })} className={cx(btnMini, 'mr-2 border-sky-500/30 text-sky-400 hover:bg-sky-500/10')}>Create work order</button>}
                      <button onClick={() => setModal({ type: 'resolve', inc: i })} className={cx(btnMini, 'border-lime-400 bg-lime-400 text-zinc-950')}>Resolve</button>
                    </>
                  )}
                  {canManage && i.resolution_status === 'resolved' && <button onClick={() => act(() => eqApi.setIncidentStatus(i.id, { status: 'closed' }))} className={cx(btnMini, 'border-zinc-700 text-zinc-300')}>Close</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No tickets here" hint="Breakdowns reported by staff appear here with their response deadline." />}
      </div>
    </div>
  );
}

function MaintenanceTab({ data, filter, setFilter, canManage, isOwner, setModal, act }) {
  const list = data.maintenance || [];
  const plans = data.plans || [];
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {[['open', 'Open'], ['overdue', 'Overdue'], ['completed', 'Completed'], ['', 'All']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cx(btnMini, filter === k ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-700 text-zinc-300')}>{l}</button>
            ))}
          </div>
          {isOwner && <button onClick={() => act(() => eqApi.runScheduler())} className={btnGhost}>Generate due work orders now</button>}
        </div>
        <div className={cx(card, 'overflow-x-auto')}>
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-500">
              <tr><Th>Due</Th><Th>Machine</Th><Th>Task</Th><Th>Priority</Th><Th>Cost</Th><Th>Status</Th><Th right>Action</Th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {list.map((m) => (
                <tr key={m.id}>
                  <td className={cx('px-4 py-3 font-mono', m.display_status === 'overdue' && 'font-bold text-red-400')}>{fdate(m.scheduled_date)}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-white">{m.equipment_name}</p><p className="text-[11px] text-zinc-500">{m.branch_name}</p></td>
                  <td className="px-4 py-3"><p>{m.title}</p><p className="text-[11px] text-zinc-500">{lbl(m.maintenance_type)}{m.plan_title ? ' · from plan' : ''}{m.assignee_name ? ` · ${m.assignee_name}` : ''}</p></td>
                  <td className="px-4 py-3"><Badge v={m.priority} /></td>
                  <td className="px-4 py-3 font-mono">{m.status === 'completed' ? inr(m.actual_cost) : m.estimated_cost ? `~${inr(m.estimated_cost)}` : '—'}</td>
                  <td className="px-4 py-3"><Badge v={m.display_status} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canManage && ['scheduled', 'overdue'].includes(m.status) && <button onClick={() => act(() => eqApi.startMaintenance(m.id))} className={cx(btnMini, 'mr-2 border-sky-500/30 text-sky-400 hover:bg-sky-500/10')}>Start</button>}
                    {canManage && ['scheduled', 'in_progress', 'overdue'].includes(m.status) && (
                      <>
                        <button onClick={() => setModal({ type: 'cancel-wo', wo: m })} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>Cancel</button>
                        <button onClick={() => setModal({ type: 'complete', wo: m })} className={cx(btnMini, 'border-lime-400 bg-lime-400 text-zinc-950')}>Complete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty title="No work orders" hint="Schedule a task, or add a recurring plan and work orders will appear on their own." />}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Recurring plans ({plans.length})</h3>
          {canManage && <button onClick={() => setModal({ type: 'plan' })} className={btnPrimary}>New plan</button>}
        </div>
        <div className={cx(card, 'overflow-x-auto')}>
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-500"><tr><Th>Machine</Th><Th>Plan</Th><Th>Repeats</Th><Th>Next due</Th><Th>Status</Th><Th right>Action</Th></tr></thead>
            <tbody className="divide-y divide-zinc-800/60">
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3"><p className="font-semibold text-white">{p.equipment_name}</p><p className="text-[11px] text-zinc-500">{p.branch_name}</p></td>
                  <td className="px-4 py-3">{p.title}</td>
                  <td className="px-4 py-3">Every {p.frequency_days} days</td>
                  <td className="px-4 py-3 font-mono">{fdate(p.next_due_date)}</td>
                  <td className="px-4 py-3"><Badge v={p.is_active ? 'active' : 'inactive'} />{p.is_active ? '' : ' paused'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <button onClick={() => setModal({ type: 'plan', plan: p })} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>Edit</button>
                        <button onClick={() => act(() => eqApi.updatePlan(p.id, { is_active: !p.is_active }))} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>{p.is_active ? 'Pause' : 'Resume'}</button>
                        <button onClick={() => window.confirm('Remove this plan? Existing work orders are kept.') && act(() => eqApi.deletePlan(p.id))} className={cx(btnMini, 'border-red-500/30 text-red-400 hover:bg-red-500/10')}>Remove</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {plans.length === 0 && <Empty title="No recurring plans yet" hint="A plan creates preventive work orders automatically, so no service is forgotten." />}
        </div>
      </div>
    </div>
  );
}

function PartsTab({ data, canManage, setModal }) {
  const list = data.parts || [];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">{canManage && <button onClick={() => setModal({ type: 'part' })} className={btnPrimary}>Add spare part</button>}</div>
      <div className={cx(card, 'overflow-x-auto')}>
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-500"><tr><Th>Code</Th><Th>Part</Th><Th>Branch</Th><Th>In stock</Th><Th>Reorder at</Th><Th>Unit cost</Th><Th>Stock value</Th><Th right>Action</Th></tr></thead>
          <tbody className="divide-y divide-zinc-800/60">
            {list.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono font-bold text-lime-400">{p.part_code}</td>
                <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                <td className="px-4 py-3 text-zinc-400">{p.branch_name}</td>
                <td className={cx('px-4 py-3 font-semibold', p.low_stock ? 'text-red-400' : '')}>{Number(p.quantity_on_hand)} {p.unit}{p.low_stock && <span className="ml-1.5 text-[11px]">low</span>}</td>
                <td className="px-4 py-3">{Number(p.reorder_level)}</td>
                <td className="px-4 py-3 font-mono">{inr(p.unit_cost)}</td>
                <td className="px-4 py-3 font-mono">{inr(p.stock_value)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <button onClick={() => setModal({ type: 'part', part: p })} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>Edit</button>
                      <button onClick={() => setModal({ type: 'restock', part: p })} className={cx(btnMini, 'border-lime-400 bg-lime-400 text-zinc-950')}>Add stock</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No spare parts tracked" hint="Track belts, cables and pads. Stock is deducted automatically when a work order uses a part." />}
      </div>
    </div>
  );
}

function ContractsTab({ data, setModal }) {
  const list = data.contracts || [];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={() => setModal({ type: 'contract' })} className={btnPrimary}>New contract</button></div>
      <div className={cx(card, 'overflow-x-auto')}>
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-500"><tr><Th>Contract</Th><Th>Vendor</Th><Th>Cover</Th><Th>Ends</Th><Th>Yearly cost</Th><Th>Machines</Th><Th>Status</Th><Th right>Action</Th></tr></thead>
          <tbody className="divide-y divide-zinc-800/60">
            {list.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3"><p className="font-semibold text-white">{c.title}</p><p className="text-[11px] text-zinc-500">{c.contract_number || lbl(c.contract_type).toUpperCase()}</p></td>
                <td className="px-4 py-3">{c.vendor_name || '—'}</td>
                <td className="px-4 py-3 text-zinc-400">{c.branch_name || 'All branches'}</td>
                <td className={cx('px-4 py-3', c.status === 'active' && c.days_left <= 30 && 'font-bold text-amber-400')}>{fdate(c.end_date)}{c.status === 'active' && c.days_left >= 0 && <span className="ml-1 text-[11px] text-zinc-500">({c.days_left} days)</span>}</td>
                <td className="px-4 py-3 font-mono">{inr(c.annual_cost)}</td>
                <td className="px-4 py-3">{c.equipment_count}</td>
                <td className="px-4 py-3"><Badge v={c.status} /></td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setModal({ type: 'contract', contract: c })} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>Edit</button>
                  <button onClick={() => setModal({ type: 'assign-contract', contract: c })} className={cx(btnMini, 'border-lime-400 bg-lime-400 text-zinc-950')}>Link machines</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No contracts" hint="Add AMC and warranty contracts so you are reminded before cover ends." />}
      </div>
    </div>
  );
}

function TransfersTab({ data, isOwner, act }) {
  const list = data.transfers || [];
  return (
    <div className={cx(card, 'overflow-x-auto')}>
      <table className="w-full text-left text-xs text-zinc-300">
        <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-500"><tr><Th>Machine</Th><Th>From</Th><Th>To</Th><Th>Reason</Th><Th>Requested by</Th><Th>Status</Th><Th right>Action</Th></tr></thead>
        <tbody className="divide-y divide-zinc-800/60">
          {list.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3"><p className="font-semibold text-white">{t.equipment_name}</p><p className="font-mono text-[11px] text-zinc-500">{t.equipment_code}</p></td>
              <td className="px-4 py-3">{t.from_branch_name}</td>
              <td className="px-4 py-3">{t.to_branch_name}</td>
              <td className="max-w-xs px-4 py-3 text-zinc-400">{t.reason}</td>
              <td className="px-4 py-3">{t.requested_by_name || '—'}<p className="text-[11px] text-zinc-500">{fdt(t.requested_at)}</p></td>
              <td className="px-4 py-3"><Badge v={t.status} /></td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {isOwner && t.status === 'pending' && (
                  <>
                    <button onClick={() => act(() => eqApi.decideTransfer(t.id, { decision: 'reject' }))} className={cx(btnMini, 'mr-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>Reject</button>
                    <button onClick={() => act(() => eqApi.decideTransfer(t.id, { decision: 'approve' }))} className={cx(btnMini, 'border-lime-400 bg-lime-400 text-zinc-950')}>Approve</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <Empty title="No transfers" hint="Move a machine between branches from its detail panel. Managers send a request; the owner approves." />}
    </div>
  );
}

function CategoriesTab({ lookups, canManage, setModal, act }) {
  const [cats, setCats] = useState([]);
  useEffect(() => { eqApi.categories().then((r) => r.success && setCats(r.categories || [])); }, [lookups]);
  return (
    <div className={cx(card, 'p-5')}>
      <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h3 className="text-sm font-bold text-white">Equipment categories</h3>
        {canManage && <button onClick={() => setModal({ type: 'category' })} className={btnPrimary}>New category</button>}
      </div>
      <div className="divide-y divide-zinc-800">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-3 text-xs">
            <span><span className="font-bold text-white">{c.name}</span> <span className="ml-2 text-zinc-500">{c.equipment_count} machine{c.equipment_count === 1 ? '' : 's'}</span></span>
            {canManage && <button onClick={() => window.confirm(`Delete "${c.name}"?`) && act(() => eqApi.deleteCategory(c.id))} className={cx(btnMini, 'border-red-500/30 text-red-400 hover:bg-red-500/10')}>Delete</button>}
          </div>
        ))}
        {cats.length === 0 && <Empty title="No categories yet" hint="Group machines into Cardio, Strength, Free weights and so on." />}
      </div>
    </div>
  );
}

/* =====================================================================
 * Machine detail drawer
 * ===================================================================== */
function Drawer({ drawer, onClose, canManage, isOwner, setModal, act }) {
  const d = drawer.data;
  const e = d?.equipment;
  const Row = ({ k, v }) => <div className="flex justify-between gap-3 border-b border-zinc-800/60 py-2"><span className="text-zinc-400">{k}</span><span className="text-right text-white">{v || '—'}</span></div>;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <aside className="h-full w-full max-w-lg space-y-6 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-6">
        {!e ? <p className="text-xs text-zinc-500">Loading…</p> : (
          <>
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div>
                <p className="font-mono text-xs font-bold text-lime-400">{e.equipment_code}</p>
                <h3 className="text-lg font-bold text-white">{e.name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge v={e.status} /><Badge v={e.condition} /><Badge v={e.criticality} tone={e.criticality === 'critical' ? 'red' : 'zinc'} /></div>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={btnGhost} onClick={() => printSticker(e)}>QR sticker</button>
              <button className={btnGhost} onClick={() => setModal({ type: 'inspect', eq: e })}>Inspect</button>
              <button className={btnDanger} onClick={() => setModal({ type: 'incident', equipment: e.id })}>Report fault</button>
              {canManage && (
                <>
                  <button className={btnGhost} onClick={() => setModal({ type: 'schedule', equipment: e.id })}>Schedule service</button>
                  <button className={btnGhost} onClick={() => setModal({ type: 'plan', equipment: e.id })}>Add plan</button>
                  <button className={btnGhost} onClick={() => setModal({ type: 'equipment', eq: e })}>Edit</button>
                  <button className={btnGhost} onClick={() => setModal({ type: 'status', eq: e })}>Change status</button>
                  <button className={btnGhost} onClick={() => setModal({ type: 'transfer', eq: e })}>Transfer</button>
                  <button className={btnGhost} onClick={() => setModal({ type: 'attach', eq: e })}>Attach document</button>
                  <button className={btnDanger} onClick={() => window.confirm(`Remove ${e.name} from the register? History is kept.`) && act(() => eqApi.deleteEquipment(e.id)).then((r) => r?.success && onClose())}>Remove</button>
                </>
              )}
            </div>

            <section className="text-xs">
              <Row k="Branch" v={e.branch_name} />
              <Row k="Category" v={e.category_name} />
              <Row k="Brand and model" v={[e.brand, e.model].filter(Boolean).join(' ')} />
              <Row k="Serial number" v={e.serial_number} />
              <Row k="Location" v={e.location} />
              <Row k="Purchased" v={e.purchase_date ? `${fdate(e.purchase_date)} for ${inr(e.purchase_price)}` : null} />
              <Row k="Book value today" v={inr(e.book_value)} />
              <Row k="Warranty" v={e.warranty_end_date ? `Until ${fdate(e.warranty_end_date)}${e.warranty_expired ? ' (expired)' : ''}` : null} />
              <Row k="AMC contract" v={e.contract_title} />
              <Row k="Service vendor" v={e.vendor_name} />
              <Row k="Last service" v={fdate(e.last_maintenance_date)} />
              <Row k="Next service" v={fdate(e.next_maintenance_date)} />
              <Row k="Last floor inspection" v={e.last_inspected_at ? fdt(e.last_inspected_at) : null} />
              <Row k="Failures" v={String(e.failure_count)} />
              <Row k="Total downtime" v={mins(e.total_downtime_minutes)} />
            </section>

            <Block title="Recurring plans" empty="No recurring plans." items={d.plans}>
              {(p) => <div key={p.id} className="flex items-center justify-between"><span>{p.title}<span className="block text-[11px] text-zinc-500">Every {p.frequency_days} days · next {fdate(p.next_due_date)}</span></span><Badge v={p.is_active ? 'active' : 'inactive'} /></div>}
            </Block>
            <Block title="Work orders" empty="No work orders yet." items={d.maintenance}>
              {(m) => <div key={m.id} className="flex items-center justify-between"><span>{m.title}<span className="block text-[11px] text-zinc-500">{fdate(m.scheduled_date)} · {lbl(m.maintenance_type)}{m.status === 'completed' ? ` · ${inr(m.actual_cost)}` : ''}</span></span><Badge v={m.display_status} /></div>}
            </Block>
            <Block title="Breakdown history" empty="No breakdowns recorded." items={d.incidents}>
              {(i) => <div key={i.id} className="flex items-center justify-between"><span>{i.title}<span className="block text-[11px] text-zinc-500">{i.incident_number} · {fdt(i.incident_date)}{i.downtime_minutes ? ` · down ${mins(i.downtime_minutes)}` : ''}</span></span><Badge v={i.resolution_status} /></div>}
            </Block>
            <Block title="Service log" empty="No service recorded." items={d.service_logs}>
              {(l) => <div key={l.id}><p>{l.service_title}</p><p className="text-[11px] text-zinc-500">{fdate(l.service_date)} · {inr(l.service_cost)}{l.technician_name ? ` · ${l.technician_name}` : ''}</p></div>}
            </Block>
            <Block title="Floor inspections" empty="No inspections logged." items={d.inspections}>
              {(i) => <div key={i.id} className="flex items-center justify-between"><span>{fdt(i.inspected_at)}<span className="block text-[11px] text-zinc-500">{i.inspected_by_name || 'Staff'}{i.notes ? ` · ${i.notes}` : ''}</span></span><Badge v={i.result === 'ok' ? 'good' : 'poor'} /></div>}
            </Block>
            <Block title="Documents" empty="No documents attached." items={d.attachments}>
              {(a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-lime-400 hover:underline">{a.file_name}<span className="ml-2 text-[11px] text-zinc-500">{lbl(a.doc_type)}</span></a>
                  {canManage && <button onClick={() => act(() => eqApi.deleteAttachment(a.id))} className="text-[11px] text-zinc-500 hover:text-red-400">Remove</button>}
                </div>
              )}
            </Block>
            <Block title="Status history" empty="No changes yet." items={d.history}>
              {(h) => <div key={h.id}><p>{h.old_status && h.old_status !== h.new_status ? `${lbl(h.old_status)} → ${lbl(h.new_status)}` : `Condition: ${lbl(h.old_condition)} → ${lbl(h.new_condition)}`}</p><p className="text-[11px] text-zinc-500">{fdt(h.created_at)} · {h.changed_by_name || 'System'}{h.reason ? ` · ${h.reason}` : ''}</p></div>}
            </Block>
            {!isOwner && null}
          </>
        )}
      </aside>
    </div>
  );
}

function Block({ title, items = [], empty, children }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-bold text-white">{title}</h4>
      {items.length === 0 ? <p className="text-xs text-zinc-500">{empty}</p> : (
        <div className="space-y-2 text-xs text-zinc-200">
          {items.map((it) => <div key={it.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5">{children(it)}</div>)}
        </div>
      )}
    </section>
  );
}

/* =====================================================================
 * PAGE
 * ===================================================================== */
const TABS = [
  ['overview', 'Overview'], ['fleet', 'Machines'], ['incidents', 'Breakdowns'], ['maintenance', 'Maintenance'],
  ['parts', 'Spare parts'], ['contracts', 'Contracts'], ['transfers', 'Transfers'], ['categories', 'Categories'],
];

export default function Equipment() {
  const [branch, setBranch] = useState(getSelectedBranch());
  const [lookups, setLookups] = useState({ branches: [], categories: [], vendors: [], staff: [], role: '', can_manage: false, is_owner: false });
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [fleetQ, setFleetQ] = useState({ search: '', status: '', category: '', flag: '', sort: 'created', dir: 'desc', page: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [incFilter, setIncFilter] = useState('active');
  const [mtnFilter, setMtnFilter] = useState('open');
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState('');

  const canManage = lookups.can_manage;
  const isOwner = lookups.is_owner;

  /* ---- shared data: lookups + stats ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [lk, st] = await Promise.all([eqApi.lookups(), eqApi.stats(branch)]);
      if (!alive) return;
      if (lk.success) setLookups(lk); else setLoadError(lk.message || 'Could not load equipment data.');
      if (st.success) setStats(st.stats); else if (!lk.success) setLoadError(st.message || 'Could not load equipment data.');
      if (lk.success && branch !== 'all' && !lk.branches.some((b) => b.id === branch)) { setBranch('all'); setSelectedBranch('all'); }
    })();
    return () => { alive = false; };
  }, [branch, version]);

  /* ---- debounced fleet search ---- */
  useEffect(() => {
    const t = setTimeout(() => setFleetQ((s) => (s.search === searchInput ? s : { ...s, search: searchInput, page: 1 })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ---- per-tab data ---- */
  useEffect(() => {
    if (['overview', 'categories'].includes(tab)) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      let res = { success: true };
      if (tab === 'fleet') res = await eqApi.list({ branch, ...fleetQ, limit: 25 });
      if (tab === 'incidents') res = await eqApi.incidents({ branch, status: incFilter });
      if (tab === 'parts') res = await eqApi.parts({ branch });
      if (tab === 'contracts') res = await eqApi.contracts({ branch });
      if (tab === 'transfers') res = await eqApi.transfers({ branch });
      if (tab === 'maintenance') {
        const [m, p] = await Promise.all([eqApi.maintenance({ branch, status: mtnFilter }), eqApi.plans({ branch })]);
        res = { success: m.success && p.success, message: m.message || p.message, maintenance: m.maintenance, plans: p.plans };
      }
      if (!alive) return;
      if (!res.success) setToast({ ok: false, msg: res.message || 'Could not load this tab.' });
      setData((d) => ({ ...d, [tab]: res }));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [tab, branch, fleetQ, incFilter, mtnFilter, version]);

  /* ---- drawer refresh + QR deep link ---- */
  const openDrawer = useCallback(async (id) => {
    setDrawer({ id, data: null });
    const r = await eqApi.detail(id);
    if (r.success) setDrawer({ id, data: r }); else { setDrawer(null); setToast({ ok: false, msg: r.message || 'Could not open this machine.' }); }
  }, []);

  useEffect(() => {
    if (!drawer?.id) return;
    eqApi.detail(drawer.id).then((r) => r.success && setDrawer((d) => (d ? { ...d, data: r } : d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    const scan = new URLSearchParams(window.location.search).get('scan');
    if (!scan) return;
    eqApi.byQr(scan).then((r) => {
      if (r.success) { setTab('fleet'); openDrawer(r.equipment.id); } else setToast({ ok: false, msg: r.message });
    });
  }, [openDrawer]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- actions ---- */
  const act = async (fn) => {
    const r = await fn();
    if (r?.success) { setToast({ ok: true, msg: r.message || 'Done.' }); setVersion((v) => v + 1); } else setToast({ ok: false, msg: r?.message || 'Action failed.' });
    return r;
  };
  const done = (msg) => { setModal(null); if (msg) setToast({ ok: true, msg }); setVersion((v) => v + 1); };
  const jump = (t, patch) => { if (patch) setFleetQ((s) => ({ ...s, ...patch, page: 1 })); setTab(t); };
  const changeBranch = (b) => { setBranch(b); setSelectedBranch(b); setFleetQ((s) => ({ ...s, page: 1 })); };
  const exportCsv = async () => { const r = await eqApi.exportCsv({ branch }); setToast({ ok: r.success, msg: r.message }); };

  const needsOptions = ['incident', 'schedule', 'plan'].includes(modal?.type);
  const options = useEquipmentOptions(branch, needsOptions);
  const d = data[tab] || {};

  const kpis = useMemo(() => (stats ? [
    { label: 'Total machines', value: stats.total, sub: `${stats.health_percent}% in working order`, onClick: () => jump('fleet') },
    { label: 'Out of order', value: stats.out_of_order, tone: stats.out_of_order ? 'text-red-400' : 'text-white', sub: stats.safety_open ? `${stats.safety_open} safety issue${stats.safety_open > 1 ? 's' : ''}` : 'No safety flags', onClick: () => jump('fleet', { status: 'out_of_order' }) },
    { label: 'Overdue service', value: stats.maintenance.overdue, tone: stats.maintenance.overdue ? 'text-amber-400' : 'text-white', sub: `${stats.maintenance.due_this_week} due this week`, onClick: () => jump('maintenance') },
    { label: 'Open breakdowns', value: stats.open_incidents, tone: stats.open_incidents ? 'text-amber-400' : 'text-white', sub: stats.sla_breached ? `${stats.sla_breached} past response time` : 'Within response time', onClick: () => jump('incidents') },
    { label: 'Spend this month', value: inr(stats.maintenance.cost_this_month), sub: `${stats.pm_compliance_percent ?? '—'}${stats.pm_compliance_percent === null ? '' : '%'} preventive compliance` },
    { label: 'Book value', value: inr(stats.book_value), tone: 'text-lime-400', sub: `Bought for ${inr(stats.asset_cost)}` },
  ] : []), [stats]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError && !lookups.branches.length) {
    return <div className={cx(card, 'p-10 text-center')}><p className="text-sm font-semibold text-white">Equipment could not be loaded</p><p className="mt-1 text-xs text-zinc-400">{loadError}</p><button className={cx(btnPrimary, 'mt-4')} onClick={() => { setLoadError(''); setVersion((v) => v + 1); }}>Try again</button></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipment and maintenance</h1>
          <p className="text-xs text-zinc-400">Track every machine, breakdown, service and spare part across your branches.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lookups.branches.length > 1 && (
            <select aria-label="Branch" value={branch} onChange={(e) => changeBranch(e.target.value)} className={cx(inputCls, 'w-auto')}>
              <option value="all">All branches</option>
              {lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button onClick={() => setModal({ type: 'incident' })} className={btnDanger}>Report fault</button>
          {canManage && (
            <>
              <button onClick={() => setModal({ type: 'schedule' })} className={cx(btnGhost, 'text-lime-400')}>Schedule service</button>
              <button onClick={() => setModal({ type: 'import' })} className={btnGhost}>Import CSV</button>
              <button onClick={exportCsv} className={btnGhost}>Export</button>
              <button onClick={() => setModal({ type: 'equipment' })} className={btnPrimary}>Register machine</button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpis.length ? kpis.map((k) => <Kpi key={k.label} {...k} />) : Array.from({ length: 6 }).map((_, i) => <div key={i} className={cx(card, 'h-24 animate-pulse')} />)}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 pb-2" role="tablist">
        {TABS.filter(([k]) => canManage || !['contracts', 'transfers'].includes(k)).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition', tab === k ? 'bg-zinc-800 text-lime-400' : 'text-zinc-400 hover:text-white')}>{l}</button>
        ))}
      </div>

      {loading && tab !== 'overview' && <p className="text-xs text-zinc-500">Loading…</p>}

      {tab === 'overview' && <OverviewTab stats={stats} branch={branch} lookups={lookups} jump={jump} openDrawer={openDrawer} />}
      {tab === 'fleet' && <FleetTab data={d} loading={loading} q={fleetQ} setQ={setFleetQ} searchInput={searchInput} setSearchInput={setSearchInput} lookups={lookups} canManage={canManage} openDrawer={openDrawer} setModal={setModal} />}
      {tab === 'incidents' && <IncidentsTab data={d} filter={incFilter} setFilter={setIncFilter} canManage={canManage} setModal={setModal} act={act} />}
      {tab === 'maintenance' && <MaintenanceTab data={d} filter={mtnFilter} setFilter={setMtnFilter} canManage={canManage} isOwner={isOwner} setModal={setModal} act={act} />}
      {tab === 'parts' && <PartsTab data={d} canManage={canManage} setModal={setModal} />}
      {tab === 'contracts' && canManage && <ContractsTab data={d} setModal={setModal} />}
      {tab === 'transfers' && canManage && <TransfersTab data={d} isOwner={isOwner} act={act} />}
      {tab === 'categories' && <CategoriesTab lookups={lookups} canManage={canManage} setModal={setModal} act={act} />}

      {/* Drawer */}
      {drawer && <Drawer drawer={drawer} onClose={() => setDrawer(null)} canManage={canManage} isOwner={isOwner} setModal={setModal} act={act} />}

      {/* Modals */}
      {modal?.type === 'equipment' && <EquipmentModal initial={modal.eq} lookups={lookups} branch={branch} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'incident' && <IncidentModal opts={options} defaultEquipment={modal.equipment} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'resolve' && <ResolveModal inc={modal.inc} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'incident-status' && <IncidentStatusModal inc={modal.inc} lookups={lookups} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'schedule' && <ScheduleModal opts={options} lookups={lookups} defaultEquipment={modal.equipment} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'complete' && <CompleteModal wo={modal.wo} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'cancel-wo' && <CancelWoModal wo={modal.wo} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'plan' && <PlanModal initial={modal.plan} opts={options} lookups={lookups} defaultEquipment={modal.equipment} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'category' && <CategoryModal onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'part' && <PartModal initial={modal.part} lookups={lookups} branch={branch} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'restock' && <RestockModal part={modal.part} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'contract' && <ContractModal initial={modal.contract} lookups={lookups} branch={branch} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'assign-contract' && <AssignContractModal contract={modal.contract} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'transfer' && <TransferModal eq={modal.eq} lookups={lookups} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'status' && <StatusModal eq={modal.eq} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'inspect' && <InspectModal eq={modal.eq} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'attach' && <AttachModal eq={modal.eq} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'import' && <ImportModal lookups={lookups} branch={branch} onClose={() => setModal(null)} onDone={done} />}

      {/* Toast */}
      {toast && (
        <div role="status" className={cx('fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border px-4 py-3 text-xs font-semibold shadow-xl', toast.ok ? 'border-emerald-500/30 bg-emerald-950 text-emerald-300' : 'border-red-500/30 bg-red-950 text-red-300')}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}