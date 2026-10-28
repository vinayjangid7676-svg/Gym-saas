import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../../api';
import { InvNav, Feedback, useInventoryData, useBranchId, inputCls, labelCls, PAYMENT_METHODS } from './InventoryShared';
import { useBranch } from '../../context/BranchContext';

// Indian Numbering System in Words
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function threeDigits(n) {
  if (n >= 100) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
  return twoDigits(n);
}

export function numberToWordsINR(amount) {
  const num = Math.round(Math.abs(amount || 0));
  if (num === 0) return 'Zero Rupees Only';
  let n = num;
  let parts = [];
  if (Math.floor(n / 10000000)) {
    parts.push(threeDigits(Math.floor(n / 10000000)) + ' Crore');
    n %= 10000000;
  }
  if (Math.floor(n / 100000)) {
    parts.push(threeDigits(Math.floor(n / 100000)) + ' Lakh');
    n %= 100000;
  }
  if (Math.floor(n / 1000)) {
    parts.push(threeDigits(Math.floor(n / 1000)) + ' Thousand');
    n %= 1000;
  }
  if (n) parts.push(threeDigits(n));
  return parts.join(' ') + ' Rupees Only';
}

// ================================================================
// TOP-TIER PRINT TEMPLATE WITH ITEMIZED FREIGHT & INSTALLMENT HISTORY
// ================================================================
export function printPurchaseOrder(po, branchId) {
  const itemsRows = (po.items || []).map((it, i) => {
    const qty = parseFloat(it.quantity || 0);
    const cost = parseFloat(it.unit_cost || 0);
    const taxable = qty * cost;
    const taxAmt = parseFloat(it.tax_amount || 0);
    const lineTotal = parseFloat(it.total_cost || (taxable + taxAmt));
    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div class="pname">${it.product_name || ''}</div>
          <div class="psku">SKU: ${it.sku || '—'} | HSN: ${it.hsn_code || '—'}</div>
        </td>
        <td>${it.batch_number || '—'}</td>
        <td>${it.expiry_date ? new Date(it.expiry_date).toLocaleDateString('en-IN') : '—'}</td>
        <td class="num">${it.quantity}</td>
        <td class="num">₹${cost.toFixed(2)}</td>
        <td class="num">₹${taxable.toFixed(2)}</td>
        <td class="num">${it.tax_rate || 0}%<br><span style="font-size:9.5px;color:#666;">₹${taxAmt.toFixed(2)}</span></td>
        <td class="num">₹${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // Installment history rows
  const paymentHistoryRows = (po.payments_history && po.payments_history.length > 0)
    ? po.payments_history.map((tx, idx) => `
        <tr>
          <td>#${idx + 1}</td>
          <td>${new Date(tx.transaction_date).toLocaleDateString('en-IN')}</td>
          <td>${tx.reference || 'Bank Settlement'}</td>
          <td>${tx.notes || 'Partial payment settlement'}</td>
          <td class="num" style="color: #059669; font-weight: 700;">₹${parseFloat(tx.amount).toFixed(2)}</td>
        </tr>
      `).join('')
    : (parseFloat(po.paid_amount || 0) > 0 ? `
        <tr>
          <td>#1</td>
          <td>${new Date(po.purchase_date).toLocaleDateString('en-IN')}</td>
          <td>Initial Clearance</td>
          <td>Recorded during goods receipt</td>
          <td class="num" style="color: #059669; font-weight: 700;">₹${parseFloat(po.paid_amount).toFixed(2)}</td>
        </tr>
      ` : `
        <tr>
          <td colspan="5" style="text-align: center; color: #888; font-style: italic; padding: 10px;">
            No payments settled yet. This bill is on 100% vendor credit.
          </td>
        </tr>
      `);

  const subtotal = parseFloat(po.subtotal || 0);
  const tax = parseFloat(po.tax_amount || 0);
  const freight = parseFloat(po.freight_amount || 0);
  const roundOff = parseFloat(po.round_off_amount || 0);
  const total = parseFloat(po.total_amount || 0);
  const paid = parseFloat(po.paid_amount || 0);
  const due = parseFloat(po.due_amount !== undefined ? po.due_amount : Math.max(0, total - paid));

  const statusLabel = due <= 0.01 ? 'PAID IN FULL' : (paid > 0 ? 'PARTIALLY PAID' : 'UNPAID / CREDIT');
  const badgeColor = due <= 0.01 ? '#059669' : (paid > 0 ? '#d97706' : '#dc2626');

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Purchase Invoice & Settlement Slip #${po.purchase_number}</title>
    <style>
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
      body { margin: 0; padding: 30px; color: #111827; font-size: 11.5px; background: #fff; }
      .doc { max-width: 900px; margin: 0 auto; position: relative; }
      .watermark {
        position: absolute;
        top: 250px;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-25deg);
        font-size: 65px;
        font-weight: 900;
        color: ${badgeColor};
        opacity: 0.08;
        border: 5px solid ${badgeColor};
        padding: 10px 40px;
        text-transform: uppercase;
        letter-spacing: 4px;
        pointer-events: none;
        user-select: none;
      }
      .head { display: flex; justify-content: space-between; border-bottom: 2.5px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
      .head h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
      .status-pill { display: inline-block; font-size: 10px; font-weight: 700; color: #fff; background: ${badgeColor}; padding: 3px 10px; border-radius: 999px; margin-top: 5px; text-transform: uppercase; }
      .meta { text-align: right; font-size: 11.5px; line-height: 1.5; }
      .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 14px; border-radius: 8px; }
      .party h3 { font-size: 10.5px; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; letter-spacing: 0.5px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
      th { background: #1f2937; color: #fff; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
      td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
      .pname { font-weight: 700; color: #111827; }
      .psku { font-size: 9.5px; color: #6b7280; }
      .num { text-align: right; }
      .section-title { font-size: 11.5px; font-weight: 700; color: #1f2937; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
      .totals-wrap { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; }
      .words { width: 50%; font-size: 11px; font-style: italic; color: #4b5563; padding-right: 15px; }
      .totals { width: 340px; font-size: 11.5px; }
      .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
      .totals .grand { border-top: 2px solid #111827; margin-top: 6px; padding-top: 6px; font-size: 13px; font-weight: 800; color: #111827; }
      .totals .paid { color: #059669; font-weight: 700; }
      .totals .due { border-top: 1.5px dashed #d1d5db; margin-top: 4px; padding-top: 6px; color: #dc2626; font-size: 13px; font-weight: 800; }
      .footer { display: flex; justify-content: space-between; margin-top: 45px; font-size: 10.5px; }
      .sign { border-top: 1px solid #9ca3af; width: 190px; padding-top: 6px; text-align: center; font-weight: 600; color: #4b5563; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="doc">
      <div class="watermark">${statusLabel}</div>
      <div class="head">
        <div>
          <h1>PURCHASE TAX INVOICE & GOODS RECEIPT</h1>
          <div class="status-pill">${statusLabel}</div>
        </div>
        <div class="meta">
          <div>PO Number: <strong>${po.purchase_number}</strong></div>
          <div>Issue Date: <strong>${new Date(po.purchase_date).toLocaleDateString('en-IN')}</strong></div>
          <div>Branch Code: <strong>#${branchId || 'HQ-MAIN'}</strong></div>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>Supplier Details</h3>
          <p style="margin: 2px 0; font-size:13px;"><strong>${po.vendor_name || 'Direct Wholesale Supplier'}</strong></p>
          <p style="margin: 1px 0; color:#4b5563;">GSTIN: ${po.vendor_gstin || 'Unregistered Vendor'}</p>
          ${po.vendor_phone ? `<p style="margin: 1px 0; color:#4b5563;">Contact: ${po.vendor_phone}</p>` : ''}
        </div>
        <div class="party" style="text-align:right;">
          <h3>Receiving Destination</h3>
          <p style="margin: 2px 0; font-size:13px;"><strong>${po.branch_name || 'Gym Enterprise Branch'}</strong></p>
          <p style="margin: 1px 0; color:#4b5563;">Status: <strong>${statusLabel}</strong></p>
          <p style="margin: 1px 0; color:#4b5563;">Verified Inward By: Store Admin</p>
        </div>
      </div>

      <div class="section-title">Inward Material Line Items</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Description & SKU</th>
            <th>Batch</th>
            <th>Expiry</th>
            <th class="num">Qty</th>
            <th class="num">Rate</th>
            <th class="num">Taxable</th>
            <th class="num">GST</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="totals-wrap">
        <div class="words">
          <strong>Amount in Words:</strong><br />
          ${numberToWordsINR(total)}
        </div>
        <div class="totals">
          <div><span>Taxable Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
          <div><span>GST (CGST + SGST)</span><span>₹${tax.toFixed(2)}</span></div>
          ${freight > 0 ? `<div><span>Inward Freight / Delivery Charges</span><span style="font-weight:600;color:#b45309;">+₹${freight.toFixed(2)}</span></div>` : ''}
          ${roundOff !== 0 ? `<div><span>Round Off</span><span>${roundOff >= 0 ? '+' : ''}₹${roundOff.toFixed(2)}</span></div>` : ''}
          <div class="grand"><span>Net Invoice Amount</span><span>₹${total.toFixed(2)}</span></div>
          <div class="paid"><span>Total Paid to Date</span><span>₹${paid.toFixed(2)}</span></div>
          <div class="due"><span>Remaining Due Balance</span><span>₹${due.toFixed(2)}</span></div>
        </div>
      </div>

      <div class="section-title">
        <span>Payment Settlement & Installments History</span>
        <span style="font-size: 10px; font-weight: normal; color: #6b7280;">Audit Trail</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Installment</th>
            <th>Date</th>
            <th>Reference / UTR</th>
            <th>Particulars</th>
            <th class="num">Amount Paid</th>
          </tr>
        </thead>
        <tbody>
          ${paymentHistoryRows}
        </tbody>
      </table>

      <div class="footer">
        <div class="sign">Receiver / Store Keeper Signature</div>
        <div class="sign">Authorized Accounts Manager</div>
      </div>
    </div>
    <script>window.onload = () => window.print();</script>
  </body>
  </html>
  `;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

export default function PurchaseHistoryPage() {
  const { vendors, refresh } = useInventoryData();
  const { activeBranch } = useBranch();
  const getBranchId = useBranchId();
  const branchId = getBranchId();

  const [, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState({
    total_count: 0,
    total_billed: 0,
    total_paid: 0,
    total_due: 0,
    unpaid_count: 0,
    partial_count: 0,
    paid_count: 0
  });

  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedPoId, setExpandedPoId] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [settlePo, setSettlePo] = useState(null);
  const [settleForm, setSettleForm] = useState({ amount: '', payment_method: 'bank_transfer', reference: '' });
  const [settleLoading, setSettleLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchTerm.trim());
        setPage(1);
      });
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (branchId) qParams.append('branch_id', branchId);
      if (debouncedSearch) qParams.append('search', debouncedSearch);
      if (statusFilter) qParams.append('status', statusFilter);
      if (vendorFilter) qParams.append('vendor_id', vendorFilter);
      if (startDate) qParams.append('start_date', startDate);
      if (endDate) qParams.append('end_date', endDate);

      qParams.append('limit', String(pageSize));
      qParams.append('offset', String((page - 1) * pageSize));

      const res = await apiGet(`/api/v1/inventory/purchases?${qParams.toString()}`);
      const list = res?.data || res?.purchases || (Array.isArray(res) ? res : []);
      setHistory(list);

      if (res?.summary) {
        setMetrics(res.summary);
      }
    } catch (err) {
      console.error('History fetch failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [branchId, debouncedSearch, statusFilter, vendorFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const resetAllFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('');
    setVendorFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleOpenSettle = (po) => {
    setSettlePo(po);
    const due = parseFloat(po.due_amount !== undefined ? po.due_amount : (po.total_amount - (po.paid_amount || 0)));
    setSettleForm({
      amount: due.toFixed(2),
      payment_method: 'bank_transfer',
      reference: '',
    });
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settlePo || !settleForm.amount || parseFloat(settleForm.amount) <= 0) return;

    setSettleLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiPost('/api/v1/inventory/purchases/settle-payment', {
        purchase_id: parseInt(settlePo.id, 10),
        amount: parseFloat(settleForm.amount),
        payment_method: settleForm.payment_method,
        reference: settleForm.reference || undefined,
      });

      if (res?.success) {
        setSuccess(res.message);
        setSettlePo(null);
        await Promise.all([fetchHistory(), refresh()]);
      } else {
        setError(res?.message || 'Payment settlement fail hua.');
      }
    } catch (err) {
      setError(err?.message || 'Network request error.');
    } finally {
      setSettleLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!history.length) return;
    const headers = ['PO Number', 'Date', 'Vendor', 'GSTIN', 'Subtotal (INR)', 'Freight (INR)', 'Total (INR)', 'Paid (INR)', 'Due (INR)', 'Payment Status'];
    const rows = history.map((h) => [
      `"${h.purchase_number}"`,
      `"${new Date(h.purchase_date).toLocaleDateString('en-IN')}"`,
      `"${(h.vendor_name || 'Direct Supplier').replace(/"/g, '""')}"`,
      `"${h.vendor_gstin || 'N/A'}"`,
      h.subtotal,
      h.freight_amount || 0,
      h.total_amount,
      h.paid_amount,
      h.due_amount,
      `"${h.payment_status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(metrics.total_count / pageSize) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Purchase Orders & Accounts Payable</h1>
          <p className="text-sm text-zinc-400">Track paid, partial, and credit inward supplier orders and settle vendor dues</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {activeBranch && (
            <span className="text-xs font-mono font-bold text-lime-400 bg-lime-400/10 border border-lime-400/20 px-3 py-1.5 rounded-xl">
              📍 Branch: {activeBranch.name}
            </span>
          )}
          <button
            onClick={handleExportCSV}
            disabled={history.length === 0}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-40"
          >
            📊 Export CSV
          </button>
          <Link
            to="/inventory/purchases"
            className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-1.5"
          >
            <span>+</span> Record New Purchase
          </Link>
        </div>
      </div>

      <InvNav />
      <Feedback success={success} error={error} onDismiss={() => { setSuccess(''); setError(''); }} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Total Purchases Incurred</span>
          <p className="text-2xl font-bold font-mono text-white">₹{metrics.total_billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <span className="text-[11px] text-zinc-500 mt-1 block">{metrics.total_count} Verified Inward Bills</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mb-1">Total Cleared / Settled</span>
          <p className="text-2xl font-bold font-mono text-emerald-400">₹{metrics.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <span className="text-[11px] text-zinc-500 mt-1 block">{metrics.paid_count} Fully Paid Invoices</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1">Outstanding Vendor Balance</span>
          <p className="text-2xl font-bold font-mono text-red-400">₹{metrics.total_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <span className="text-[11px] text-zinc-500 mt-1 block">{metrics.unpaid_count} Unpaid · {metrics.partial_count} Partial</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col justify-center">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Ledger Health Distribution</span>
          <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${metrics.total_billed > 0 ? (metrics.total_paid / metrics.total_billed) * 100 : 0}%` }} 
              className="bg-emerald-400 h-full" 
              title="Settled" 
            />
            <div 
              style={{ width: `${metrics.total_billed > 0 ? (metrics.total_due / metrics.total_billed) * 100 : 0}%` }} 
              className="bg-red-500 h-full" 
              title="Due Balance" 
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2 font-mono">
            <span className="text-emerald-400">Paid: {metrics.total_billed > 0 ? ((metrics.total_paid / metrics.total_billed) * 100).toFixed(0) : 0}%</span>
            <span className="text-red-400">Pending: {metrics.total_billed > 0 ? ((metrics.total_due / metrics.total_billed) * 100).toFixed(0) : 0}%</span>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Search Purchase Orders</label>
            <input
              type="text"
              placeholder="Search by PO #, Vendor, GSTIN, SKU, or Product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={inputCls}
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid (Fully Cleared)</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="unpaid">Unpaid / Credit</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Filter By Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
              className={inputCls}
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Date Range</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className={`${inputCls} px-1.5 text-xs scheme-dark`}
                title="Start Date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className={`${inputCls} px-1.5 text-xs scheme-dark`}
                title="End Date"
              />
            </div>
          </div>
        </div>

        {(searchTerm || statusFilter || vendorFilter || startDate || endDate) && (
          <div className="flex justify-between items-center pt-2 border-t border-zinc-800/60">
            <span className="text-xs text-lime-400 font-medium">
              Filtered Results: {metrics.total_count} matching bills found
            </span>
            <button
              onClick={resetAllFilters}
              className="text-xs text-zinc-400 hover:text-white transition font-medium flex items-center gap-1"
            >
              ✕ Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Purchase Records</h3>
            <p className="text-xs text-zinc-500">Live inventory inward ledger & payment statuses</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchHistory}
              className="text-xs text-lime-400 hover:text-lime-300 font-mono transition"
            >
              🔄 Refresh
            </button>
            <span className="text-xs font-semibold bg-zinc-800 px-3 py-1 rounded-full text-zinc-400 font-mono">
              Showing {history.length} of {metrics.total_count}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-500 uppercase border-b border-zinc-800 tracking-wider">
              <tr>
                <th className="py-4 px-5">PO Reference</th>
                <th className="py-4 px-5">Date</th>
                <th className="py-4 px-5">Vendor</th>
                <th className="py-4 px-5 text-right">Bill Total</th>
                <th className="py-4 px-5 text-right">Paid</th>
                <th className="py-4 px-5 text-right">Due Balance</th>
                <th className="py-4 px-5 text-center">Payment Status</th>
                <th className="py-4 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {historyLoading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-zinc-500 text-xs">
                    <div className="inline-block w-6 h-6 border-2 border-lime-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Filtering & Loading Purchase Ledger...</p>
                  </td>
                </tr>
              ) : history.map((h) => {
                const isExpanded = expandedPoId === h.id;
                const paid = parseFloat(h.paid_amount || 0);
                const total = parseFloat(h.total_amount || 0);
                const due = parseFloat(h.due_amount !== undefined ? h.due_amount : Math.max(0, total - paid));
                const isUnpaid = due > 0.01;
                const freightVal = parseFloat(h.freight_amount || 0);

                return (
                  <React.Fragment key={h.id}>
                    <tr className="hover:bg-zinc-800/40 transition">
                      <td className="py-4 px-5 font-mono text-lime-400 font-bold">
                        {h.purchase_number}
                        {h.branch_name && h.branch_name !== 'Main Branch' && (
                          <span className="block text-[10px] text-zinc-500 font-normal font-sans">
                            {h.branch_name}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 font-mono text-zinc-400">{new Date(h.purchase_date).toLocaleDateString('en-IN')}</td>
                      <td className="py-4 px-5 text-zinc-200">
                        <div className="font-medium">{h.vendor_name || 'Direct Supplier'}</div>
                        {h.vendor_gstin && <div className="text-[10px] text-zinc-500 font-mono">GSTIN: {h.vendor_gstin}</div>}
                      </td>
                      <td className="py-4 px-5 text-right font-bold text-white font-mono">₹{total.toFixed(2)}</td>
                      <td className="py-4 px-5 text-right font-mono text-emerald-400 font-semibold">₹{paid.toFixed(2)}</td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-red-400">₹{due.toFixed(2)}</td>
                      <td className="py-4 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          h.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          h.payment_status === 'partially_paid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {h.payment_status ? h.payment_status.replace('_', ' ') : 'unpaid'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center space-x-2">
                        {isUnpaid && (
                          <button
                            onClick={() => handleOpenSettle(h)}
                            className="px-2.5 py-1 bg-lime-400 hover:bg-lime-300 text-black font-extrabold rounded-lg text-xs transition shadow-sm"
                          >
                            💳 Settle Due
                          </button>
                        )}
                        <button 
                          onClick={() => printPurchaseOrder(h, branchId)} 
                          className="px-2 py-1 text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-lg text-xs font-semibold transition"
                          title="Print Inward Tax Slip & Installments"
                        >
                          🖨️ Slip
                        </button>
                        <button 
                          onClick={() => setExpandedPoId(isExpanded ? null : h.id)} 
                          className="px-2 py-1 text-zinc-400 hover:text-lime-400 bg-zinc-800/80 hover:bg-zinc-800 rounded-lg text-xs transition"
                        >
                          {isExpanded ? 'Hide ▲' : 'Details ▼'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-zinc-950/90 border-t-0 shadow-inner">
                        <td colSpan="8" className="p-5 space-y-4">
                          {/* 1. Items List */}
                          <div className="border border-zinc-800/80 rounded-xl p-4 bg-zinc-900/40 space-y-3">
                            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                              <h4 className="font-bold text-lime-400 text-[11px] uppercase tracking-wider">
                                Inward Line Items, Batch & Tax Breakdown
                              </h4>
                              <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                                <span>Subtotal: ₹{h.subtotal?.toFixed(2)}</span>
                                <span>GST: ₹{h.tax_amount?.toFixed(2)}</span>
                                {freightVal > 0 && (
                                  <span className="text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                    🚚 Freight: +₹{freightVal.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {(h.items || []).map((item, i) => (
                                <div key={i} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px] space-y-1">
                                  <p className="font-bold text-white truncate">{item.product_name}</p>
                                  <div className="flex justify-between text-zinc-500 font-mono text-[10px]">
                                    <span>SKU: {item.sku}</span>
                                    <span>HSN: {item.hsn_code || '—'}</span>
                                  </div>
                                  <div className="flex justify-between text-zinc-400 font-mono text-[10px]">
                                    <span>Batch: {item.batch_number || 'N/A'}</span>
                                    <span>Exp: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-2 border-t border-zinc-800/80 text-zinc-400">
                                    <span>Qty: <strong className="text-zinc-200 font-mono">{item.quantity}</strong></span>
                                    <span>Cost: <strong className="text-zinc-300 font-mono">₹{item.unit_cost}</strong></span>
                                    <span>GST: <strong className="text-lime-400 font-mono">{item.tax_rate || 0}%</strong></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 2. Partial Payments History Ledger */}
                          <div className="border border-zinc-800/80 rounded-xl p-4 bg-zinc-900/40 space-y-2">
                            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                              <h4 className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider">
                                Partial Payments & Settlement Audit History
                              </h4>
                              <span className="text-[11px] text-zinc-400">
                                Total Settled: <strong className="text-emerald-400 font-mono">₹{paid.toFixed(2)}</strong> / ₹{total.toFixed(2)}
                              </span>
                            </div>
                            {h.payments_history && h.payments_history.length > 0 ? (
                              <div className="divide-y divide-zinc-800/50">
                                {h.payments_history.map((tx, idx) => (
                                  <div key={idx} className="py-2 flex justify-between items-center text-xs">
                                    <div>
                                      <span className="font-mono text-zinc-400 mr-2">{new Date(tx.transaction_date).toLocaleDateString('en-IN')}</span>
                                      <span className="text-zinc-200 font-medium">{tx.reference || 'Bank Settlement'}</span>
                                      <p className="text-[10px] text-zinc-500">{tx.notes}</p>
                                    </div>
                                    <div className="font-mono font-bold text-emerald-400">
                                      +₹{parseFloat(tx.amount).toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500 py-1 italic">
                                {paid > 0 ? `Initial payment of ₹${paid.toFixed(2)} made during order receipt.` : 'Is purchase ke liye abhi tak koi partial payment nahi hui hai.'}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!historyLoading && history.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-zinc-500 text-sm">
                    Koi purchase order match nahi hua. Filters adjust karke dobara try karein.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-zinc-950/40">
          <div className="text-xs text-zinc-500 font-medium">
            Page <span className="text-white font-mono">{page}</span> of{' '}
            <span className="text-white font-mono">{totalPages}</span> ({metrics.total_count} total orders)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || historyLoading}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold disabled:opacity-40 transition"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || historyLoading}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Settle Modal */}
      {settlePo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Settle Vendor Due Balance</h3>
                <p className="text-xs text-zinc-500 font-mono">PO: {settlePo.purchase_number} · Vendor: {settlePo.vendor_name || 'Direct'}</p>
              </div>
              <button onClick={() => setSettlePo(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex justify-between text-xs">
                <span className="text-zinc-400">Total Outstanding Balance:</span>
                <span className="font-bold font-mono text-red-400 text-sm">
                  ₹{parseFloat(settlePo.due_amount !== undefined ? settlePo.due_amount : (settlePo.total_amount - (settlePo.paid_amount || 0))).toFixed(2)}
                </span>
              </div>
              <div>
                <label className={labelCls}>Installment Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={settlePo.due_amount !== undefined ? settlePo.due_amount : (settlePo.total_amount - (settlePo.paid_amount || 0))}
                  required
                  value={settleForm.amount}
                  onChange={(e) => setSettleForm({ ...settleForm, amount: e.target.value })}
                  className={`${inputCls} font-mono font-bold text-lime-400`}
                />
              </div>
              <div>
                <label className={labelCls}>Payment Mode</label>
                <select
                  value={settleForm.payment_method}
                  onChange={(e) => setSettleForm({ ...settleForm, payment_method: e.target.value })}
                  className={inputCls}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Transaction / Cheque / UTR Reference</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-87236482 / Cheque No"
                  value={settleForm.reference}
                  onChange={(e) => setSettleForm({ ...settleForm, reference: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlePo(null)}
                  className="px-4 py-2 text-xs rounded-xl text-zinc-400 hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-lime-400 hover:bg-lime-300 text-black disabled:opacity-50 transition"
                >
                  {settleLoading ? 'Recording Installment...' : 'Confirm Payment Clearance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}