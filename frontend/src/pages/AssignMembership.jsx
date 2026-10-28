import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api';

const inputCls =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none';
const labelCls = 'text-xs text-zinc-400 block mb-1';

export default function AssignMembership() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  const [formData, setFormData] = useState({
    member_id: '',
    plan_id: '',
    branch_id: '',
    start_date: new Date().toISOString().split('T')[0],
    discount_amount: '',
    paid_amount: '',
  });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [result, setResult] = useState(null); // success response
  const [error, setError] = useState('');

  // ─── Members & Plans fetch ───
  useEffect(() => {
    const fetchData = async () => {
      setFetchLoading(true);
      const [mRes, pRes] = await Promise.all([
        apiGet('/api/v1/members?limit=100'),
        apiGet('/api/v1/plans'),
      ]);
      if (mRes?.success) setMembers(mRes.data || []);
      if (pRes?.success) setPlans(pRes.data || []);
      setFetchLoading(false);
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  // ─── Selected plan & live price calculation ───
  const selectedPlan = useMemo(
    () => plans.find((p) => String(p.id) === String(formData.plan_id)),
    [plans, formData.plan_id]
  );

  const calculation = useMemo(() => {
    if (!selectedPlan) return null;
    const base = parseFloat(selectedPlan.base_price) || 0;
    const taxRate = parseFloat(selectedPlan.tax_percentage) || 0;
    const taxAmt = (base * taxRate) / 100;
    const gross = base + taxAmt;
    const discount = parseFloat(formData.discount_amount) || 0;
    const total = Math.max(0, gross - discount);
    const paid = parseFloat(formData.paid_amount) || 0;
    const due = Math.max(0, total - paid);

    // End date bhi dikhayein (same logic jo backend use karta hai)
    const start = new Date(formData.start_date);
    const end = new Date(start);
    end.setDate(start.getDate() + Number(selectedPlan.duration_days));

    return {
      base,
      taxAmt,
      gross,
      total,
      paid,
      due,
      endDateStr: end.toISOString().split('T')[0],
    };
  }, [selectedPlan, formData.discount_amount, formData.paid_amount, formData.start_date]);

  // ─── Submit ───
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setResult(null);

    const payload = {
      member_id: formData.member_id,
      plan_id: formData.plan_id,
      branch_id: formData.branch_id,
      start_date: formData.start_date,
      discount_amount: parseFloat(formData.discount_amount) || 0,
      paid_amount: parseFloat(formData.paid_amount) || 0,
    };

    const res = await apiPost('/api/v1/memberships/assign', payload);
    if (res?.success) {
      setResult(res.data);
    } else {
      setError(res?.message || 'Membership assign karne me issue aaya.');
    }
    setSubmitLoading(false);
  };

  const resetForm = () => {
    setFormData({
      member_id: '',
      plan_id: '',
      branch_id: '',
      start_date: new Date().toISOString().split('T')[0],
      discount_amount: '',
      paid_amount: '',
    });
    setResult(null);
    setError('');
  };

  if (fetchLoading) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 text-sm">
        Loading members aur plans...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Assign Membership</h1>
        <p className="text-sm text-zinc-400">Member ko plan assign karein — price auto-calculate hoga</p>
      </div>

      {/* ─── SUCCESS STATE ─── */}
      {result ? (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <h3 className="text-lg font-bold text-emerald-400">Membership Assign Ho Gaya!</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Membership ID</p>
              <p className="font-mono text-lime-400 text-xs break-all">{result.hash_id}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Status</p>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {result.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Start Date</p>
              <p className="text-zinc-200">{new Date(result.start_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">End Date</p>
              <p className="text-zinc-200">{new Date(result.end_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Total Amount</p>
              <p className="text-zinc-200 font-semibold">₹{result.total_amount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Due Amount</p>
              <p className={`font-semibold ${parseFloat(result.due_amount) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                ₹{result.due_amount}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold"
            >
              + Assign Another
            </button>
            <button
              onClick={() => navigate('/members')}
              className="px-4 py-2 rounded-xl text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
            >
              Members List pe Jao
            </button>
          </div>
        </div>
      ) : (
        /* ─── FORM ─── */
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Member Select */}
          <div>
            <label className={labelCls}>Member *</label>
            <select
              name="member_id"
              required
              value={formData.member_id}
              onChange={handleChange}
              className={inputCls}
            >
              <option value="">Member select karein</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_code} — {m.first_name} {m.last_name || ''} ({m.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Plan Select */}
          <div>
            <label className={labelCls}>Membership Plan *</label>
            <select
              name="plan_id"
              required
              value={formData.plan_id}
              onChange={handleChange}
              className={inputCls}
            >
              <option value="">Plan select karein</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.base_price} / {p.duration_days} days
                </option>
              ))}
            </select>
          </div>

          {/* Branch + Start Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Branch ID *</label>
              <input
                type="number"
                name="branch_id"
                required
                placeholder="e.g. 1"
                value={formData.branch_id}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Start Date *</label>
              <input
                type="date"
                name="start_date"
                required
                value={formData.start_date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
          </div>

          {/* Discount + Paid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Discount (₹)</label>
              <input
                type="number"
                name="discount_amount"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.discount_amount}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Paid Amount (₹)</label>
              <input
                type="number"
                name="paid_amount"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.paid_amount}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
          </div>

          {/* ─── Live Price Summary ─── */}
          {calculation && (
            <div className="border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
              <h4 className="text-sm font-semibold text-zinc-300 mb-3">Price Summary</h4>
              <SummaryRow label={`Base Price (${selectedPlan.name})`} value={`₹${calculation.base.toFixed(2)}`} />
              <SummaryRow label={`Tax (${selectedPlan.tax_percentage || 0}%)`} value={`₹${calculation.taxAmt.toFixed(2)}`} />
              <SummaryRow label="Gross Total" value={`₹${calculation.gross.toFixed(2)}`} />
              <SummaryRow label="Discount" value={`- ₹${(parseFloat(formData.discount_amount) || 0).toFixed(2)}`} highlight />
              <div className="border-t border-zinc-800 my-2" />
              <SummaryRow label="Final Total" value={`₹${calculation.total.toFixed(2)}`} bold />
              <SummaryRow label="Paid" value={`₹${calculation.paid.toFixed(2)}`} />
              <SummaryRow
                label="Due Amount"
                value={`₹${calculation.due.toFixed(2)}`}
                bold
                valueClass={calculation.due > 0 ? 'text-red-400' : 'text-emerald-400'}
              />
              <div className="border-t border-zinc-800 my-2" />
              <SummaryRow label="Valid Till" value={calculation.endDateStr} bold />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => navigate('/members')}
              className="px-4 py-2 rounded-xl text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold disabled:opacity-50"
            >
              {submitLoading ? 'Assigning...' : 'Assign Membership'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Small row helper for price summary
function SummaryRow({ label, value, bold, highlight, valueClass = '' }) {
  return (
    <div className="flex justify-between">
      <span className={`text-zinc-400 ${bold ? 'font-semibold text-zinc-200' : ''}`}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${highlight ? 'text-amber-400' : 'text-zinc-200'} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}