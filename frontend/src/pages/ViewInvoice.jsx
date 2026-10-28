import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Partial Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    const res = await apiGet(`/api/v1/billing/invoices/${id}`);
    if (res?.success) {
      setData(res.data);
      const due = parseFloat(res.data.total_amount) - parseFloat(res.data.paid_sum || 0);
      setPayAmount(due > 0 ? due.toFixed(2) : '');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleRecordInstallment = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      alert('Valid payment amount daaliye.');
      return;
    }

    setSubmitting(true);
    const res = await apiPost('/api/v1/billing/payments', {
      invoice_id: data.id,
      branch_id: data.branch_id,
      member_id: data.member_id,
      amount: parseFloat(payAmount),
      payment_method: payMethod,
      transaction_reference: payRef || null
    });

    if (res?.success) {
      alert(`Payment recorded! ${res.message}`);
      setShowPayModal(false);
      setPayRef('');
      await fetchInvoice();
    } else {
      alert(res?.message || 'Payment record karne me error aayi.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-500 font-mono">Loading invoice & receipts audit trail...</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-red-400">
        Invoice nahi mila. <button onClick={() => navigate('/billing')} className="underline ml-2">Back to Billing</button>
      </div>
    );
  }

  const subtotal = parseFloat(data.subtotal || 0);
  const discount = parseFloat(data.discount_amount || 0);
  const tax = parseFloat(data.tax_amount || 0);
  const total = parseFloat(data.total_amount || 0);
  const paid = parseFloat(data.paid_sum || 0);
  const due = Math.max(0, total - paid);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 print:p-0 print:max-w-none">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/billing')}
          className="text-zinc-400 hover:text-white text-sm font-semibold flex items-center gap-1"
        >
          ← Back to Billing
        </button>
        <div className="flex gap-2">
          {due > 0 && (
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              + Pay Due Balance (₹{due.toFixed(2)})
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-sm rounded-xl transition"
          >
            🖨️ Print Tax Invoice
          </button>
        </div>
      </div>

      {/* Main Printable Tax Invoice Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl print:border-none print:bg-white print:text-black">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-zinc-800 print:border-zinc-300 pb-6">
          <div>
            <h1 className="text-2xl font-black text-white print:text-black">{data.org_name || 'GYM MANAGEMENT'}</h1>
            <p className="text-xs text-zinc-400 print:text-zinc-600">{data.branch_name} | {data.branch_address || ''}</p>
            {data.org_gstin && <p className="text-xs text-zinc-400 print:text-zinc-600">GSTIN: {data.org_gstin}</p>}
            <p className="text-xs text-zinc-400 print:text-zinc-600">Phone: {data.branch_phone || '—'}</p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-lime-400/10 border border-lime-400/20 text-lime-400 font-mono text-xs font-bold rounded-lg uppercase">
              Tax Invoice
            </span>
            <h2 className="text-lg font-mono font-bold text-lime-400 print:text-black mt-2">{data.invoice_number}</h2>
            <p className="text-xs text-zinc-400 print:text-zinc-600">
              Bill Date: {new Date(data.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Member Details */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-zinc-500 uppercase font-semibold">Billed To:</p>
            <p className="text-white print:text-black font-bold text-sm">{data.first_name} {data.last_name || ''}</p>
            <p className="text-zinc-400 print:text-zinc-600">Member ID: #{data.member_code || data.member_id}</p>
            <p className="text-zinc-400 print:text-zinc-600">Phone: {data.member_phone || '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 uppercase font-semibold">Payment Status:</p>
            <span className={`inline-block mt-1 px-3 py-0.5 rounded text-xs font-bold uppercase ${
              data.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
              data.payment_status === 'partially_paid' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {data.payment_status.replace('_', ' ')}
            </span>
            {data.due_date && (
              <p className="text-zinc-400 print:text-zinc-600 mt-1">Due Date: {new Date(data.due_date).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {/* Itemized Table */}
        <div className="border border-zinc-800 print:border-zinc-300 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 print:bg-zinc-100 text-zinc-400 print:text-zinc-700 font-semibold border-b border-zinc-800 print:border-zinc-300">
              <tr>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 print:divide-zinc-200">
              {data.items?.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 px-3 font-medium text-white print:text-black">{item.description}</td>
                  <td className="py-2.5 px-3 text-zinc-400 capitalize">{item.item_type}</td>
                  <td className="py-2.5 px-3 text-right text-zinc-300 print:text-black">{parseFloat(item.quantity)}</td>
                  <td className="py-2.5 px-3 text-right text-zinc-300 print:text-black">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-white print:text-black">₹{parseFloat(item.total_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invoice Financial Summary */}
        <div className="flex justify-end text-xs">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Discount:</span>
                <span>- ₹{discount.toFixed(2)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Taxes (GST):</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white print:text-black text-sm border-t border-zinc-800 pt-1.5">
              <span>Net Total:</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-400">
              <span>Total Paid:</span>
              <span>₹{paid.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between font-bold text-sm border-t border-zinc-800 pt-1.5 ${due > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
              <span>Balance Due:</span>
              <span>₹{due.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* PAYMENT SCHEDULE & RECEIPT AUDIT TRAIL (CHRONOLOGICAL) */}
        {/* ================================================================ */}
        <div className="space-y-3 border-t border-zinc-800 print:border-zinc-300 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white print:text-black flex items-center gap-1.5">
              <span>📜</span> Official Payment Receipts / Installment Schedule
            </h3>
            <span className="text-[11px] text-zinc-500">Total Transactions: {data.payments?.length || 0}</span>
          </div>

          <div className="border border-zinc-800 print:border-zinc-300 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 print:bg-zinc-100 text-zinc-400 print:text-zinc-700 font-semibold border-b border-zinc-800 print:border-zinc-300">
                <tr>
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reference / Txn ID</th>
                  <th className="py-2.5 px-3">Received By</th>
                  <th className="py-2.5 px-3 text-right">Amount Paid</th>
                  <th className="py-2.5 px-3 text-right">Balance Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 print:divide-zinc-200">
                {data.payments?.map((pay, idx) => (
                  <tr key={pay.id} className="hover:bg-zinc-800/30">
                    <td className="py-2.5 px-3 font-mono text-lime-400 print:text-black font-bold">
                      {pay.receipt_number || `REC-${pay.id}`}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 print:text-black">
                      {new Date(pay.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-zinc-400 print:text-black">
                      {pay.payment_method.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-500">
                      {pay.transaction_reference || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {pay.staff_name || 'Staff'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400 print:text-black">
                      ₹{parseFloat(pay.amount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-400 print:text-black">
                      ₹{parseFloat(pay.balance_after_payment || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {(!data.payments || data.payments.length === 0) && (
                  <tr>
                    <td colSpan="7" className="py-4 text-center text-zinc-500">
                      Abhi tak koi payment receive nahi hui hai. (Invoice Unpaid)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pay Due Balance Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Record Partial / Due Payment</h3>
                <p className="text-xs text-zinc-400">Invoice: {data.invoice_number}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordInstallment} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Paying Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={due}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Total Pending Due: ₹{due.toFixed(2)}</span>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Payment Method *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="upi_qr">UPI / QR Code</option>
                  <option value="pos_machine">Card / POS Terminal</option>
                  <option value="bank_transfer">Direct Bank Transfer / NEFT</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Transaction Ref / UTR / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref # or Bank UTR"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm rounded-xl transition disabled:opacity-50 mt-2"
              >
                {submitting ? 'Generating Official Receipt...' : 'Confirm & Generate Receipt'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}