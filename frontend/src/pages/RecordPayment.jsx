import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api';

const inputCls =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none';
const labelCls = 'text-xs text-zinc-400 block mb-1';

const PAYMENT_METHODS = ['cash', 'upi_qr', 'pos_machine', 'razorpay', 'stripe', 'bank_transfer', 'cheque', 'other'];

export default function RecordPayment() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  const [formData, setFormData] = useState({
    member_id: '',
    invoice_id: '',
    branch_id: '',
    amount: '',
    payment_method: 'cash',
    transaction_reference: '',
  });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // ─── Members fetch ───
  useEffect(() => {
    const fetchMembers = async () => {
      const res = await apiGet('/api/v1/members?limit=100');
      if (res?.success) setMembers(res.data || []);
      setFetchLoading(false);
    };
    fetchMembers();
  }, []);

  // ─── Member select hone pe uske due invoices fetch ───
  useEffect(() => {
    if (!formData.member_id) {
      setInvoices([]);
      return;
    }
    const fetchInvoices = async () => {
      const res = await apiGet(`/api/v1/billing/invoices?member_id=${formData.member_id}&status=due`);
      if (res?.success) setInvoices(res.data || []);
    };
    fetchInvoices();
  }, [formData.member_id]);

  // ─── Selected invoice ka due nikalo ───
  const selectedInvoice = useMemo(
    () => invoices.find((inv) => String(inv.id) === String(formData.invoice_id)),
    [invoices, formData.invoice_id]
  );

  const dueAmount = selectedInvoice
    ? parseFloat(selectedInvoice.total_amount) - parseFloat(selectedInvoice.paid_sum || 0)
    : 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setResult(null);

    const res = await apiPost('/api/v1/billing/payments', {
      ...formData,
      amount: parseFloat(formData.amount),
    });

    if (res?.success) {
      setResult(res.data);
    } else {
      setError(res?.message || 'Payment record karne me issue aaya.');
    }
    setSubmitLoading(false);
  };

  const resetForm = () => {
    setFormData({
      member_id: '',
      invoice_id: '',
      branch_id: '',
      amount: '',
      payment_method: 'cash',
      transaction_reference: '',
    });
    setResult(null);
    setError('');
  };

  if (fetchLoading) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Record Payment</h1>
        <p className="text-sm text-zinc-400">Due invoice ke against payment receive karein</p>
      </div>

      {/* ─── SUCCESS STATE ─── */}
      {result ? (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <h3 className="text-lg font-bold text-emerald-400">Payment Record Ho Gayi!</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Amount</p>
              <p className="text-emerald-400 font-semibold">₹{result.payment.amount} ({result.payment.payment_method})</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Invoice Status</p>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {result.updated_invoice_status.replace('_', ' ')}
              </span>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Remaining Due</p>
              <p className={`font-semibold ${parseFloat(result.remaining_due) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                ₹{result.remaining_due}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Payment ID</p>
              <p className="font-mono text-lime-400 text-xs break-all">{result.payment.hash_id}</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold">
              + Another Payment
            </button>
            <button onClick={() => navigate('/billing')} className="px-4 py-2 rounded-xl text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium">
              Billing pe Wapas
            </button>
          </div>
        </div>
      ) : (
        /* ─── FORM ─── */
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className={labelCls}>Member *</label>
            <select name="member_id" required value={formData.member_id} onChange={handleChange} className={inputCls}>
              <option value="">Member select karein</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_code} — {m.first_name} {m.last_name || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Due Invoice *</label>
            <select name="invoice_id" required value={formData.invoice_id} onChange={handleChange} className={inputCls} disabled={!formData.member_id}>
              <option value="">{formData.member_id ? 'Invoice select karein' : 'Pehle member select karein'}</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — Total ₹{inv.total_amount} • Due ₹{(parseFloat(inv.total_amount) - parseFloat(inv.paid_sum || 0)).toFixed(2)}
                </option>
              ))}
            </select>
            {formData.member_id && invoices.length === 0 && (
              <p className="text-xs text-zinc-500 mt-1">Is member ka koi due invoice nahi hai. 🎉</p>
            )}
          </div>

          {selectedInvoice && (
            <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4 text-sm">
              <p className="text-amber-400 font-semibold mb-1">Due Balance: ₹{dueAmount.toFixed(2)}</p>
              <p className="text-zinc-500 text-xs">
                Backend zyada amount accept nahi karega — max ₹{dueAmount.toFixed(2)} hi enter karein.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (₹) *</label>
              <input type="number" name="amount" required min="0.01" max={dueAmount || undefined} step="0.01" value={formData.amount} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Branch ID *</label>
              <input type="number" name="branch_id" required placeholder="e.g. 1" value={formData.branch_id} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Method *</label>
              <select name="payment_method" required value={formData.payment_method} onChange={handleChange} className={inputCls}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Txn Reference</label>
              <input type="text" name="transaction_reference" value={formData.transaction_reference} onChange={handleChange} className={inputCls} placeholder="UPI ref / Cheque no." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button type="button" onClick={() => navigate('/billing')} className="px-4 py-2 rounded-xl text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading || !selectedInvoice || dueAmount <= 0}
              className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold disabled:opacity-50"
            >
              {submitLoading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}