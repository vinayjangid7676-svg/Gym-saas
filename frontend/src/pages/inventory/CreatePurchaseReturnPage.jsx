import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiGet, apiPost } from '../../api';
import { InvNav, Feedback, useInventoryData, useBranchId, inputCls, labelCls } from './InventoryShared';
import { useBranch } from '../../context/BranchContext';

export default function CreatePurchaseReturnPage() {
  const navigate = useNavigate();
  const { refresh } = useInventoryData();
  const { activeBranch } = useBranch();
  const getBranchId = useBranchId();
  const branchId = getBranchId();

  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);

  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundType, setRefundType] = useState('debit_note');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const bQuery = branchId ? `?branch_id=${branchId}` : '';
      const res = await apiGet(`/api/v1/inventory/purchases${bQuery}`);
      const list = res?.data || res?.purchases || [];
      setPurchases(list);
    } catch (err) {
      console.error('Purchases fetch failed:', err);
    } finally {
      setPurchasesLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleSelectPo = (poId) => {
    setSelectedPoId(poId);
    setError('');
    if (!poId) {
      setSelectedPo(null);
      setReturnItems([]);
      return;
    }
    const found = purchases.find((p) => String(p.id) === String(poId));
    if (found) {
      setSelectedPo(found);
      const itemsPrepared = (found.items || []).map((it) => ({
        // Fallback checks for id & product_id
        product_id: it.product_id || it.id,
        product_name: it.product_name || 'Item',
        sku: it.sku || '',
        batch_number: it.batch_number || '',
        hsn_code: it.hsn_code || '',
        bought_quantity: parseFloat(it.quantity || 0),
        unit_cost: parseFloat(it.unit_cost || 0),
        tax_rate: parseFloat(it.tax_rate || 0),
        return_quantity: '',
        selected: false,
      }));
      setReturnItems(itemsPrepared);
    }
  };

  const handleItemToggle = (idx) => {
    const updated = [...returnItems];
    updated[idx].selected = !updated[idx].selected;
    if (!updated[idx].selected) {
      updated[idx].return_quantity = '';
    } else if (!updated[idx].return_quantity) {
      updated[idx].return_quantity = '1';
    }
    setReturnItems(updated);
  };

  const handleItemQuantityChange = (idx, value) => {
    const updated = [...returnItems];
    updated[idx].return_quantity = value;
    const q = parseFloat(value) || 0;
    updated[idx].selected = q > 0;
    setReturnItems(updated);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let itemCount = 0;

    returnItems.forEach((it) => {
      const q = parseFloat(it.return_quantity) || 0;
      if (it.selected && q > 0) {
        const lineSub = q * it.unit_cost;
        const lineTax = lineSub * (it.tax_rate / 100);
        subtotal += lineSub;
        taxTotal += lineTax;
        itemCount += 1;
      }
    });

    return {
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal,
      itemCount,
    };
  }, [returnItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPo) {
      setError('Original Purchase Order select karna anivarya hai.');
      return;
    }

    const activeItems = returnItems.filter(
      (it) => it.selected && parseFloat(it.return_quantity) > 0
    );

    if (activeItems.length === 0) {
      setError('Kam se kam ek item ki valid return quantity select karein.');
      return;
    }

    if (!returnReason.trim()) {
      setError('Return ka valid business reason enter karein.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        purchase_id: parseInt(selectedPo.id, 10),
        return_date: returnDate,
        reason: returnReason.trim(),
        refund_type: refundType,
        items: activeItems.map((it) => ({
          product_id: parseInt(it.product_id, 10),
          quantity: parseFloat(it.return_quantity),
          unit_cost: parseFloat(it.unit_cost),
          tax_rate: parseFloat(it.tax_rate),
          batch_number: it.batch_number || undefined,
          hsn_code: it.hsn_code || undefined,
        })),
      };

      const res = await apiPost('/api/v1/inventory/purchases/return', payload);
      if (res?.success) {
        setSuccess(`✅ ${res.message}`);
        await refresh();
        setTimeout(() => {
          navigate('/inventory/returns');
        }, 1200);
      } else {
        setError(res?.message || 'Debit Note generation fail hua.');
      }
    } catch (err) {
      setError(err?.message || 'Network request error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Issue Purchase Return & Debit Note
          </h1>
          <p className="text-sm text-zinc-400">
            Damaged, defective ya surplus stock vendor ko lautayein aur GST debit note generate karein
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeBranch && (
            <span className="text-xs font-mono font-bold text-lime-400 bg-lime-400/10 border border-lime-400/20 px-3 py-1.5 rounded-xl">
              📍 Branch: {activeBranch.name}
            </span>
          )}
          <Link
            to="/inventory/returns"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            ← View Return Ledger
          </Link>
        </div>
      </div>

      <InvNav />
      <Feedback success={success} error={error} onDismiss={() => { setSuccess(''); setError(''); }} />

      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-zinc-950 px-6 py-5 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-[10px] font-bold text-red-400 tracking-widest uppercase">
              Reverse Inward Movement
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">
              Debit Note Entry Portal
            </h2>
          </div>
          {totals.itemCount > 0 && (
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                Selected for Return: {totals.itemCount} items
              </span>
              <span className="text-lg font-mono font-bold text-red-400">
                ₹{totals.grandTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className={labelCls}>Select Original Inward PO Ref *</label>
              <select
                required
                value={selectedPoId}
                onChange={(e) => handleSelectPo(e.target.value)}
                disabled={purchasesLoading}
                className={inputCls}
              >
                <option value="">-- Choose Purchase Invoice --</option>
                {purchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purchase_number} · {p.vendor_name || 'Direct Supplier'} (Total: ₹{parseFloat(p.total_amount).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Debit Note Date *</label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={`${inputCls} scheme-dark`}
              />
            </div>

            <div>
              <label className={labelCls}>Settlement Ledger Impact *</label>
              <select
                value={refundType}
                onChange={(e) => setRefundType(e.target.value)}
                className={inputCls}
              >
                <option value="debit_note">Debit Note (Deduct Due Liability)</option>
                <option value="bank_refund">Bank Refund Received</option>
                <option value="cash_refund">Cash Refund Received</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Return Reason / Defect Specification *</label>
            <input
              type="text"
              required
              placeholder="e.g. Expired batch received, packaging torn, leakage during transit"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className={inputCls}
            />
          </div>

          {selectedPo && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-zinc-500 uppercase text-[10px] block">Vendor</span>
                <span className="font-bold text-white">{selectedPo.vendor_name || 'Direct Supplier'}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase text-[10px] block">Vendor GSTIN</span>
                <span className="text-zinc-300">{selectedPo.vendor_gstin || 'Unregistered'}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase text-[10px] block">Original Invoice Value</span>
                <span className="text-zinc-300">₹{parseFloat(selectedPo.total_amount).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase text-[10px] block">Current PO Balance</span>
                <span className="font-bold text-red-400">₹{parseFloat(selectedPo.due_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          )}

          {selectedPo && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Select Line Items To Return
                </span>
                <span className="text-[11px] text-zinc-500">
                  Multiple items can be returned simultaneously
                </span>
              </div>

              <div className="space-y-2.5">
                {returnItems.map((it, idx) => {
                  const returnQtyNum = parseFloat(it.return_quantity) || 0;
                  const lineSub = returnQtyNum * it.unit_cost;
                  const lineTax = lineSub * (it.tax_rate / 100);
                  const lineTotal = lineSub + lineTax;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        it.selected
                          ? 'bg-zinc-950 border-red-500/50 shadow-inner'
                          : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={it.selected}
                          onChange={() => handleItemToggle(idx)}
                          className="mt-1 accent-red-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs sm:text-sm truncate">
                            {it.product_name}
                          </p>
                          <div className="flex flex-wrap gap-2 text-[10px] font-mono text-zinc-400 mt-0.5">
                            <span>SKU: {it.sku}</span>
                            {it.hsn_code && <span>HSN: {it.hsn_code}</span>}
                            {it.batch_number && <span>Batch: {it.batch_number}</span>}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 mt-1">
                            Purchased: <strong className="text-zinc-300">{it.bought_quantity}</strong> units · Cost: ₹{it.unit_cost.toFixed(2)} · GST: {it.tax_rate}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                            Return Qty (Max {it.bought_quantity})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={it.bought_quantity}
                            step="any"
                            placeholder="0"
                            value={it.return_quantity}
                            onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                            className="w-32 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-center font-mono font-bold text-white focus:border-red-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className="w-28 text-right bg-zinc-900/60 border border-zinc-800 px-3 py-1.5 rounded-xl">
                          <span className="text-[9px] text-zinc-500 uppercase block">Line Reversal</span>
                          <span className="font-mono font-bold text-red-400 text-xs truncate block">
                            ₹{lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totals.itemCount > 0 && (
            <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-zinc-500 uppercase text-[10px] block font-semibold">Taxable Reversal</span>
                <span className="text-white text-base font-bold">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 uppercase text-[10px] block font-semibold">GST Reversal</span>
                <span className="text-amber-400 text-base font-bold">₹{totals.taxTotal.toFixed(2)}</span>
              </div>
              <div className="space-y-1 sm:text-right">
                <span className="text-zinc-500 uppercase text-[10px] block font-semibold">Total Debit Note Amount</span>
                <span className="text-red-400 text-xl font-bold">₹{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => navigate('/inventory/returns')}
              className="text-xs text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !selectedPo || totals.itemCount === 0}
              className="px-8 py-3 bg-red-500 hover:bg-red-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 shadow-lg shadow-red-500/20"
            >
              {submitting ? 'Generating Debit Note...' : 'Confirm Return & Deduct Inventory'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}