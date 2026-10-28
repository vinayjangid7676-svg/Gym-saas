import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../../api';
import { InvNav, Feedback, useBranchId, inputCls } from './InventoryShared';
import { useBranch } from '../../context/BranchContext';

function printDebitNote(dn, branchId) {
  const itemsRows = (dn.items || []).map((it, i) => {
    const qty = parseFloat(it.quantity || 0);
    const cost = parseFloat(it.unit_cost || 0);
    const taxable = qty * cost;
    const taxAmt = parseFloat(it.tax_amount || 0);
    const lineTotal = parseFloat(it.total_amount || (taxable + taxAmt));
    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div class="pname">${it.product_name || ''}</div>
          <div class="psku">SKU: ${it.sku || '—'}</div>
        </td>
        <td>${it.batch_number || '—'}</td>
        <td class="num">${qty}</td>
        <td class="num">₹${cost.toFixed(2)}</td>
        <td class="num">₹${taxable.toFixed(2)}</td>
        <td class="num">${it.tax_rate || 0}% (₹${taxAmt.toFixed(2)})</td>
        <td class="num">₹${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const settlementLabel = 
    dn.refund_type === 'vendor_credit' ? 'ADVANCE CREDIT (FUTURE PO ADJUSTMENT)' :
    dn.refund_type === 'debit_note' ? 'DUE BILL DEDUCTION' :
    String(dn.refund_type).toUpperCase();

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Vendor Debit Note ${dn.debit_note_number}</title>
    <style>
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
      body { margin: 0; padding: 32px; color: #1a1a1a; font-size: 11.5px; background: #fff; }
      .doc { max-width: 850px; margin: 0 auto; }
      .head { display: flex; justify-content: space-between; border-bottom: 2.5px solid #b91c1c; padding-bottom: 14px; margin-bottom: 20px; }
      .head h1 { margin: 0; font-size: 20px; color: #b91c1c; font-weight: 800; }
      .meta { text-align: right; font-size: 11.5px; }
      .parties { display: flex; justify-content: space-between; margin-bottom: 20px; background: #fdf2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px; }
      th { background: #b91c1c; color: #fff; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; }
      td { padding: 8px 10px; border-bottom: 1px solid #eee; }
      .num { text-align: right; }
      .totals { width: 340px; margin-left: auto; font-size: 11.5px; }
      .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
      .grand { border-top: 2px solid #b91c1c; margin-top: 6px; padding-top: 8px; font-size: 13px; font-weight: 700; color: #b91c1c; }
      .reason-box { margin-top: 15px; padding: 10px; background: #fafafa; border: 1px dashed #ccc; border-radius: 6px; }
      .settlement-badge { display: inline-block; padding: 4px 8px; background: #fee2e2; border: 1px solid #f87171; color: #991b1b; font-weight: bold; border-radius: 4px; margin-top: 4px; font-size: 10px; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="doc">
      <div class="head">
        <div>
          <h1>PURCHASE DEBIT NOTE (STOCK REVERSAL)</h1>
          <div style="font-size:10px;color:#555;font-weight:600;margin-top:2px;">Original Inward PO: ${dn.purchase_number || 'N/A'}</div>
          <div class="settlement-badge">SETTLEMENT: ${settlementLabel}</div>
        </div>
        <div class="meta">
          <div>Debit Note Ref: <strong>${dn.debit_note_number}</strong></div>
          <div>Date: <strong>${new Date(dn.return_date).toLocaleDateString('en-IN')}</strong></div>
        </div>
      </div>
      <div class="parties">
        <div>
          <h3 style="margin:0 0 4px;font-size:10.5px;text-transform:uppercase;color:#777;">Supplier / Vendor</h3>
          <p style="margin:2px 0;"><strong>${dn.vendor_name || 'Direct Supplier'}</strong></p>
          <p style="margin:0;color:#555;">GSTIN: ${dn.vendor_gstin || 'Unregistered'}</p>
        </div>
        <div style="text-align:right;">
          <h3 style="margin:0 0 4px;font-size:10.5px;text-transform:uppercase;color:#777;">Returning Branch</h3>
          <p style="margin:2px 0;"><strong>Gym Branch #${branchId || 'Main'}</strong></p>
          <p style="margin:0;color:#555;">Accounting Type: <strong>${settlementLabel}</strong></p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item Details</th>
            <th>Batch</th>
            <th class="num">Return Qty</th>
            <th class="num">Cost</th>
            <th class="num">Taxable</th>
            <th class="num">GST Reversed</th>
            <th class="num">Total Value</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div class="totals">
        <div><span>Taxable Value:</span><span>₹${parseFloat(dn.subtotal || 0).toFixed(2)}</span></div>
        <div><span>CGST + SGST:</span><span>₹${parseFloat(dn.tax_amount || 0).toFixed(2)}</span></div>
        <div class="grand"><span>Net Reversal Amount:</span><span>₹${parseFloat(dn.total_amount || 0).toFixed(2)}</span></div>
      </div>
      <div class="reason-box">
        <strong>Return Justification / Accounting Notes:</strong> ${dn.reason || 'Goods returned as per supplier terms.'}
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

export default function PurchaseReturnHistoryPage() {
  const { activeBranch } = useBranch();
  const getBranchId = useBranchId();
  const branchId = getBranchId();

  const [, startTransition] = useTransition();

  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedReturnId, setExpandedReturnId] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchTerm.trim().toLowerCase());
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const bQuery = branchId ? `?branch_id=${branchId}` : '';
      const res = await apiGet(`/api/v1/inventory/purchases/returns${bQuery}`);
      setReturnsList(res?.data || []);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const filteredReturns = returnsList.filter((dn) => {
    if (!debouncedSearch) return true;
    const matchDn = dn.debit_note_number?.toLowerCase().includes(debouncedSearch);
    const matchPo = dn.purchase_number?.toLowerCase().includes(debouncedSearch);
    const matchVendor = dn.vendor_name?.toLowerCase().includes(debouncedSearch);
    return matchDn || matchPo || matchVendor;
  });

  const totalReversedValue = returnsList.reduce(
    (acc, it) => acc + (parseFloat(it.total_amount) || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Purchase Returns & Debit Notes Ledger
          </h1>
          <p className="text-sm text-zinc-400">
            Outward supplier return vouchers, tax reversal slips aur vendor debit adjustments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeBranch && (
            <span className="text-xs font-mono font-bold text-lime-400 bg-lime-400/10 border border-lime-400/20 px-3 py-1.5 rounded-xl">
              📍 Branch: {activeBranch.name}
            </span>
          )}
          <Link
            to="/inventory/returns/new"
            className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-1.5"
          >
            <span>↩</span> Issue Debit Note
          </Link>
        </div>
      </div>

      <InvNav />
      <Feedback success={success} error={error} onDismiss={() => { setSuccess(''); setError(''); }} />

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
            Total Debit Notes Issued
          </span>
          <p className="text-2xl font-bold font-mono text-white">{returnsList.length}</p>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1">
            Total Reversed Value
          </span>
          <p className="text-2xl font-bold font-mono text-red-400">
            ₹{totalReversedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center">
          <input
            type="text"
            placeholder="Search Debit Note #, PO #, Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-500 uppercase border-b border-zinc-800 tracking-wider">
              <tr>
                <th className="py-4 px-5">Debit Note Ref</th>
                <th className="py-4 px-5">Return Date</th>
                <th className="py-4 px-5">Original PO #</th>
                <th className="py-4 px-5">Supplier</th>
                <th className="py-4 px-5 text-right">Taxable</th>
                <th className="py-4 px-5 text-right">GST Reversed</th>
                <th className="py-4 px-5 text-right">Total Debit</th>
                <th className="py-4 px-5 text-center">Settlement Mode</th>
                <th className="py-4 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-zinc-500">
                    Loading Debit Notes Ledger...
                  </td>
                </tr>
              ) : filteredReturns.map((dn) => {
                const isExpanded = expandedReturnId === dn.id;
                return (
                  <React.Fragment key={dn.id}>
                    <tr className="hover:bg-zinc-800/40 transition">
                      <td className="py-4 px-5 font-mono text-red-400 font-bold">{dn.debit_note_number}</td>
                      <td className="py-4 px-5 font-mono text-zinc-400">{new Date(dn.return_date).toLocaleDateString('en-IN')}</td>
                      <td className="py-4 px-5 font-mono text-lime-400">{dn.purchase_number}</td>
                      <td className="py-4 px-5 text-zinc-200">
                        <div>{dn.vendor_name || 'Direct Supplier'}</div>
                        {dn.vendor_gstin && <div className="text-[10px] text-zinc-500 font-mono">GST: {dn.vendor_gstin}</div>}
                      </td>
                      <td className="py-4 px-5 text-right font-mono">₹{parseFloat(dn.subtotal || 0).toFixed(2)}</td>
                      <td className="py-4 px-5 text-right font-mono text-amber-400">₹{parseFloat(dn.tax_amount || 0).toFixed(2)}</td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-red-400">₹{parseFloat(dn.total_amount || 0).toFixed(2)}</td>
                      <td className="py-4 px-5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          dn.refund_type === 'vendor_credit' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          {dn.refund_type === 'vendor_credit' ? 'Advance Credit' : (dn.refund_type ? dn.refund_type.replace('_', ' ') : 'Debit Note')}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center space-x-2">
                        <button
                          onClick={() => printDebitNote(dn, branchId)}
                          className="px-2.5 py-1 text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold transition"
                        >
                          🖨️ Slip
                        </button>
                        <button
                          onClick={() => setExpandedReturnId(isExpanded ? null : dn.id)}
                          className="px-2 py-1 text-zinc-400 hover:text-white bg-zinc-800/80 rounded-lg text-xs transition"
                        >
                          {isExpanded ? 'Hide ▲' : 'Items ▼'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-zinc-950/90 border-t-0 shadow-inner">
                        <td colSpan="9" className="p-5">
                          <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 space-y-3">
                            <p className="text-xs text-zinc-400 font-medium">
                              <strong className="text-zinc-200">Return Reason:</strong> {dn.reason}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {(dn.items || []).map((item, idx) => (
                                <div key={idx} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px]">
                                  <p className="font-bold text-white truncate">{item.product_name}</p>
                                  <p className="text-[10px] text-zinc-500 font-mono">SKU: {item.sku}</p>
                                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-800 text-zinc-400 font-mono">
                                    <span>Returned: <strong className="text-red-400">{item.quantity}</strong></span>
                                    <span>Cost: ₹{item.unit_cost}</span>
                                    <span>Total: ₹{item.total_amount}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!loading && filteredReturns.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-zinc-500 text-sm">
                    Koi Purchase Return / Debit Note record nahi mila.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}