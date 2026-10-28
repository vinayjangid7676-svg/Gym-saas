import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api';

const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none';
const labelCls = 'text-xs text-zinc-400 block mb-1 font-medium';

export default function Billing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'payments' | 'refunds'
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refund Modal States
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', refund_reference: '' });
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const gymUser = localStorage.getItem('gym_user');
    const parsedUser = gymUser ? JSON.parse(gymUser) : null;
    const branchId = parsedUser?.branch_id || localStorage.getItem('branch_id') || '';
    const queryStr = branchId ? `?branch_id=${branchId}` : '';

    const [invRes, payRes, refRes] = await Promise.all([
      apiGet(`/api/v1/billing/invoices${queryStr}`),
      apiGet(`/api/v1/billing/payments${queryStr}`),
      apiGet('/api/v1/discounts/refunds')
    ]);

    if (invRes?.success) setInvoices(invRes.data || []);
    if (payRes?.success) setPayments(payRes.data || []);
    if (refRes?.success) setRefunds(refRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Financial Stats
  const totalRevenueCollected = payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
  const totalRefundedAmount = refunds.reduce((acc, r) => acc + parseFloat(r.amount || 0), 0);
  const netRevenue = totalRevenueCollected - totalRefundedAmount;
  const totalDuePending = invoices.reduce((acc, inv) => {
    const total = parseFloat(inv.total_amount || 0);
    const paid = parseFloat(inv.paid_sum || inv.paid_amount || 0);
    const due = total - paid;
    return acc + (due > 0 ? due : 0);
  }, 0);

  // Process Refund Handler
  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!refundForm.amount || parseFloat(refundForm.amount) <= 0) {
      alert('Valid refund amount daaliye.');
      return;
    }
    setRefundSubmitting(true);
    const res = await apiPost('/api/v1/discounts/refunds', {
      payment_id: selectedPaymentForRefund.id,
      amount: parseFloat(refundForm.amount),
      reason: refundForm.reason || null,
      refund_reference: refundForm.refund_reference || null
    });
    if (res?.success) {
      alert(res.message || 'Refund successfully process ho gaya.');
      setSelectedPaymentForRefund(null);
      setRefundForm({ amount: '', reason: '', refund_reference: '' });
      await fetchData();
    } else {
      alert(res?.message || 'Refund process karne me error aayi.');
    }
    setRefundSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Financial Control</h1>
          <p className="text-sm text-zinc-400">Gym invoices, payments, discounts aur refunds audit</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => navigate('/promotions')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm rounded-xl border border-zinc-700 transition flex items-center gap-1.5"
          >
            🏷️ Manage Promo & Coupons
          </button>
          <button
            onClick={() => navigate('/billing/record-payment')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 font-semibold text-sm rounded-xl border border-zinc-700 transition"
          >
            + Record Payment
          </button>
          <button
            onClick={() => navigate('/billing/create-invoice')}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm rounded-xl transition"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 mb-1 font-medium">Total Collected (Gross)</p>
          <h3 className="text-2xl font-bold text-emerald-400">₹{totalRevenueCollected.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 mb-1 font-medium">Total Refunded</p>
          <h3 className="text-2xl font-bold text-red-400">₹{totalRefundedAmount.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 mb-1 font-medium">Net Realized Revenue</p>
          <h3 className="text-2xl font-bold text-lime-400">₹{netRevenue.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 mb-1 font-medium">Total Pending Due</p>
          <h3 className="text-2xl font-bold text-amber-400">₹{totalDuePending.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === 'invoices' ? 'bg-zinc-800 text-lime-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === 'payments' ? 'bg-zinc-800 text-lime-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Payments Received ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('refunds')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === 'refunds' ? 'bg-zinc-800 text-red-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Refund History ({refunds.length})
        </button>
      </div>

      {/* Tables Area */}
      {loading ? (
        <div className="p-8 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800">
          Loading financial data...
        </div>
      ) : activeTab === 'invoices' ? (
        /* INVOICES TABLE */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto shadow-lg">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950 text-xs text-zinc-400 border-b border-zinc-800 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Subtotal</th>
                <th className="py-3 px-4">Discount</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Paid</th>
                <th className="py-3 px-4">Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {invoices.map((inv) => {
                const subtotal = parseFloat(inv.subtotal || inv.total_amount || 0);
                const discount = parseFloat(inv.discount_amount || 0);
                const total = parseFloat(inv.total_amount || 0);
                const paid = parseFloat(inv.paid_sum || inv.paid_amount || 0);
                const due = Math.max(0, total - paid);
                const status = inv.payment_status || (due === 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid');
                return (
                  <tr key={inv.id || inv.hash_id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-3 px-4 font-mono text-lime-400 font-bold">{inv.invoice_number || `INV-${inv.id}`}</td>
                    <td className="py-3 px-4">
                      {inv.first_name || inv.member_name ? `${inv.first_name || inv.member_name} ${inv.last_name || ''}` : `Member #${inv.member_id}`}
                      {inv.member_code && <span className="text-zinc-500 text-xs ml-1 font-mono">({inv.member_code})</span>}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">₹{subtotal.toFixed(2)}</td>
                    <td className="py-3 px-4 text-amber-400 font-medium">
                      {discount > 0 ? `- ₹${discount.toFixed(2)}` : '₹0.00'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">₹{total.toFixed(2)}</td>
                    <td className="py-3 px-4 text-emerald-400 font-medium">₹{paid.toFixed(2)}</td>
                    <td className={`py-3 px-4 font-semibold ${due > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                      ₹{due.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        status === 'partially_paid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-400">
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => navigate(`/billing/invoices/${inv.id || inv.hash_id}`)}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 hover:border-lime-400/40 text-xs font-bold rounded-lg transition"
                      >
                        View 👁️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-zinc-500">Koi invoice nahi mila.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'payments' ? (
        /* PAYMENTS TABLE */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950 text-xs text-zinc-400 border-b border-zinc-800 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Txn Ref</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Received By</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Refund Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {payments.map((p) => {
                const isFullyRefunded = p.status === 'refunded';
                return (
                  <tr key={p.id || p.hash_id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                      {p.transaction_reference || (p.hash_id ? p.hash_id.slice(0, 10) : `TXN-${p.id}`)}
                    </td>
                    <td className="py-3 px-4">
                      {p.first_name ? `${p.first_name} ${p.last_name || ''}` : `Member #${p.member_id}`}
                      {p.member_code && <span className="text-zinc-500 text-xs ml-1 font-mono">({p.member_code})</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-lime-400 text-xs">{p.invoice_number || '—'}</td>
                    <td className="py-3 px-4 font-bold text-emerald-400">₹{parseFloat(p.amount || 0).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs uppercase">
                        {(p.payment_method || 'cash').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-400">{p.received_by_name || 'Staff'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                        isFullyRefunded ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {p.status || 'success'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-400">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isFullyRefunded ? (
                        <span className="text-zinc-500 text-xs font-semibold">Refunded</span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedPaymentForRefund(p);
                            setRefundForm({ amount: p.amount, reason: '', refund_reference: '' });
                          }}
                          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-red-500/20 text-red-400 border border-zinc-700 hover:border-red-500/40 rounded-lg transition font-medium"
                        >
                          ↩ Refund
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-6 text-center text-zinc-500">Koi payment record nahi mila.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* REFUND HISTORY TABLE */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950 text-xs text-zinc-400 border-b border-zinc-800 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Refund Ref</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Refunded Amount</th>
                <th className="py-3 px-4">Original Paid</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Processed By</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {refunds.map((r) => (
                <tr key={r.id || r.hash_id} className="hover:bg-zinc-800/30 transition">
                  <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                    {r.refund_reference || (r.hash_id ? r.hash_id.slice(0, 10) : `REF-${r.id}`)}
                  </td>
                  <td className="py-3 px-4">
                    {r.first_name} {r.last_name || ''}
                    {r.member_code && <span className="text-zinc-500 text-xs ml-1 font-mono">({r.member_code})</span>}
                  </td>
                  <td className="py-3 px-4 font-bold text-red-400">₹{parseFloat(r.amount || 0).toFixed(2)}</td>
                  <td className="py-3 px-4 text-zinc-400">₹{parseFloat(r.original_payment_amount || 0).toFixed(2)}</td>
                  <td className="py-3 px-4 text-xs text-zinc-300">{r.reason || 'General cancellation'}</td>
                  <td className="py-3 px-4 text-xs text-zinc-400">{r.processed_by_name || 'Admin'}</td>
                  <td className="py-3 px-4 text-xs text-zinc-400">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {refunds.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-zinc-500">Koi refund record nahi mila.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ──────────────── ISSUE REFUND MODAL ──────────────── */}
      {selectedPaymentForRefund && (
        <ModalWrapper title="Issue Payment Refund" onClose={() => setSelectedPaymentForRefund(null)}>
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs space-y-1">
            <p className="text-zinc-400">
              Member: <span className="text-white font-semibold">{selectedPaymentForRefund.first_name} {selectedPaymentForRefund.last_name || ''}</span>
            </p>
            <p className="text-zinc-400">
              Original Amount Paid: <span className="text-emerald-400 font-bold">₹{selectedPaymentForRefund.amount}</span>
            </p>
          </div>
          <form onSubmit={handleProcessRefund} className="space-y-3">
            <div>
              <label className={labelCls}>Refund Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedPaymentForRefund.amount}
                required
                value={refundForm.amount}
                onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Reason for Refund</label>
              <input
                type="text"
                placeholder="e.g. Relocated to another city / double charged"
                value={refundForm.reason}
                onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Refund Reference (Bank txn ID / Cheque)</label>
              <input
                type="text"
                placeholder="UTR / Bank reference"
                value={refundForm.refund_reference}
                onChange={(e) => setRefundForm({ ...refundForm, refund_reference: e.target.value })}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={refundSubmitting}
              className="w-full py-2.5 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 mt-2"
            >
              {refundSubmitting ? 'Processing...' : 'Confirm Refund'}
            </button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-base">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}