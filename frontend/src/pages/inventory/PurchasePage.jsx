import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../api';
import { InvNav, Feedback, useInventoryData, useBranchId, inputCls, labelCls, PAYMENT_METHODS } from './InventoryShared';
import { useBranch } from '../../context/BranchContext';

const GST_RATES = [0, 5, 12, 18, 28];

const emptyRow = () => ({
  product_id: '',
  product_name: '',
  sku: '',
  hsn_code: '',
  quantity: '1',
  unit_cost: '',
  tax_rate: '18',
  tax_amount: '0.00',
  selling_price: '',
  total_cost: '0.00',
  batch_number: '',
  expiry_date: '',
});

function SearchableProductSelect({ products, value, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => String(p.product_id || p.id) === String(value));
  }, [products, value]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, searchTerm]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full min-w-0" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-left text-sm text-white focus:border-lime-400 focus:outline-none transition flex justify-between items-center group shadow-inner"
      >
        <div className="truncate pr-2 min-w-0">
          {selectedProduct ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-white truncate text-xs">{selectedProduct.name}</span>
              <span className="text-[11px] font-mono text-lime-400 font-bold shrink-0">({selectedProduct.sku})</span>
            </div>
          ) : (
            <span className="text-zinc-500 font-medium text-xs">🔍 Select/Search product...</span>
          )}
        </div>
        <span className="text-zinc-500 group-hover:text-lime-400 text-xs shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-[999] left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 space-y-2 backdrop-blur-xl">
          <input
            type="text"
            placeholder="Type Product Name, SKU..."
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-lime-400 focus:outline-none"
          />
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {filteredProducts.map((p) => {
              const pId = p.product_id || p.id;
              const isSelected = String(pId) === String(value);
              return (
                <div
                  key={pId}
                  onClick={() => {
                    onSelect(p);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`p-2 rounded-lg text-xs cursor-pointer transition flex justify-between items-center ${
                    isSelected ? 'bg-lime-400 text-black font-bold' : 'hover:bg-zinc-800 text-zinc-200'
                  }`}
                >
                  <div className="truncate pr-2 min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className={`text-[10px] font-mono ${isSelected ? 'text-zinc-900' : 'text-zinc-400'}`}>
                      SKU: {p.sku} {p.hsn_code ? `| HSN: ${p.hsn_code}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${isSelected ? 'bg-black/20 text-black' : 'bg-zinc-800 text-lime-400'}`}>
                    Stock: {p.current_stock || 0}
                  </span>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="p-3 text-center text-xs text-zinc-500">
                Koi product match nahi hua "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchasePage() {
  const navigate = useNavigate();
  const { products, vendors, loading: sharedLoading, refresh } = useInventoryData();
  const { activeBranch } = useBranch();
  const getBranchId = useBranchId();
  const branchId = getBranchId();

  const [form, setForm] = useState({
    vendor_id: '',
    purchase_number: `PO-${Date.now().toString().slice(-6)}`,
    purchase_date: new Date().toISOString().split('T')[0],
    additional_freight: '0',
    round_off: true,
    payment_mode_selection: 'unpaid',
    paid_amount: '0',
    payment_method: 'bank_transfer',
    payment_reference: '',
    items: [emptyRow()],
  });

  const [vendorCreditBalance, setVendorCreditBalance] = useState(0);
  const [applyVendorCredit, setApplyVendorCredit] = useState(false);
  const [adjustedDebitAmount, setAdjustedDebitAmount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Check vendor credit balance whenever selected vendor changes
  useEffect(() => {
    if (!form.vendor_id) {
      setVendorCreditBalance(0);
      setApplyVendorCredit(false);
      setAdjustedDebitAmount(0);
      return;
    }
    const fetchVendorCredits = async () => {
      try {
        const res = await apiGet(`/api/v1/inventory/vendors/${form.vendor_id}/credits`);
        if (res?.success) {
          const bal = parseFloat(res.credits?.available_credit_balance || 0);
          setVendorCreditBalance(bal);
        }
      } catch (err) {
        console.error('Failed to load vendor credit balance:', err);
      }
    };
    fetchVendorCredits();
  }, [form.vendor_id]);

  const handleProductSelect = (idx, selectedProduct) => {
    const updated = [...form.items];
    const pId = selectedProduct.product_id || selectedProduct.id;
    updated[idx] = {
      ...updated[idx],
      product_id: pId,
      product_name: selectedProduct.name,
      sku: selectedProduct.sku,
      unit_cost: parseFloat(selectedProduct.purchase_price) > 0 ? String(selectedProduct.purchase_price) : '',
      selling_price: parseFloat(selectedProduct.selling_price) > 0 ? String(selectedProduct.selling_price) : '',
      tax_rate: selectedProduct.tax_rate !== undefined && selectedProduct.tax_rate !== null ? String(selectedProduct.tax_rate) : '18',
      hsn_code: selectedProduct.hsn_code || '',
    };

    const qty = parseFloat(updated[idx].quantity || 0);
    const cost = parseFloat(updated[idx].unit_cost || 0);
    const rate = parseFloat(updated[idx].tax_rate || 0);
    const baseAmount = qty * cost;
    const calculatedTax = baseAmount * (rate / 100);
    const lineTotal = baseAmount + calculatedTax;
    updated[idx].tax_amount = calculatedTax.toFixed(2);
    updated[idx].total_cost = lineTotal.toFixed(2);

    setForm({ ...form, items: updated });
  };

  const handleRowChange = (idx, field, value) => {
    const updated = [...form.items];
    updated[idx] = { ...updated[idx], [field]: value };

    if (['quantity', 'unit_cost', 'tax_rate'].includes(field)) {
      const qty = parseFloat(updated[idx].quantity || 0);
      const cost = parseFloat(updated[idx].unit_cost || 0);
      const rate = parseFloat(updated[idx].tax_rate || 0);
      const baseAmount = qty * cost;
      const calculatedTax = baseAmount * (rate / 100);
      const lineTotal = baseAmount + calculatedTax;
      updated[idx].tax_amount = calculatedTax.toFixed(2);
      updated[idx].total_cost = lineTotal.toFixed(2);
    }
    setForm({ ...form, items: updated });
  };

  const addRow = () => setForm({ ...form, items: [...form.items, emptyRow()] });
  const removeRow = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const taxableSubtotal = useMemo(() => {
    return form.items.reduce((acc, r) => {
      const qty = parseFloat(r.quantity || 0);
      const cost = parseFloat(r.unit_cost || 0);
      return acc + (qty * cost);
    }, 0);
  }, [form.items]);

  const totalGST = useMemo(() => {
    return form.items.reduce((acc, r) => acc + (parseFloat(r.tax_amount) || 0), 0);
  }, [form.items]);

  const freightAmt = parseFloat(form.additional_freight) || 0;
  const preRoundTotal = taxableSubtotal + totalGST + freightAmt;
  const roundOffAmount = form.round_off ? Math.round(preRoundTotal) - preRoundTotal : 0;
  const grandTotal = Math.max(0, preRoundTotal + roundOffAmount);

  // Auto calculate adjusted debit from vendor credit wallet
  useEffect(() => {
    if (applyVendorCredit && vendorCreditBalance > 0) {
      const deduct = Math.min(grandTotal, vendorCreditBalance);
      setAdjustedDebitAmount(deduct);
    } else {
      setAdjustedDebitAmount(0);
    }
  }, [applyVendorCredit, vendorCreditBalance, grandTotal]);

  const payableAfterCredit = Math.max(0, grandTotal - adjustedDebitAmount);

  useEffect(() => {
    if (form.payment_mode_selection === 'full') {
      setForm((prev) => ({ ...prev, paid_amount: payableAfterCredit.toFixed(2) }));
    }
  }, [form.payment_mode_selection, payableAfterCredit]);

  const resetForm = () => {
    setForm({
      vendor_id: '',
      purchase_number: `PO-${Date.now().toString().slice(-6)}`,
      purchase_date: new Date().toISOString().split('T')[0],
      additional_freight: '0',
      round_off: true,
      payment_mode_selection: 'unpaid',
      paid_amount: '0',
      payment_method: 'bank_transfer',
      payment_reference: '',
      items: [emptyRow()],
    });
    setApplyVendorCredit(false);
    setAdjustedDebitAmount(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.some((it) => !it.product_id || !it.quantity || !it.unit_cost || !it.selling_price)) {
      setError('Sabhi items me Product, Qty, Purchase Cost, Selling MRP aur GST% bharna anivarya hai.');
      return;
    }

    setSubmitting(true);
    setSuccess('');
    setError('');

    const calculatedPaidAmount = form.payment_mode_selection === 'full' 
      ? payableAfterCredit 
      : form.payment_mode_selection === 'unpaid' 
      ? 0 
      : Math.min(payableAfterCredit, parseFloat(form.paid_amount || 0));

    const payload = {
      branch_id: branchId,
      vendor_id: form.vendor_id ? parseInt(form.vendor_id, 10) : null,
      purchase_number: form.purchase_number.trim(),
      purchase_date: form.purchase_date,
      subtotal: parseFloat(taxableSubtotal.toFixed(2)),
      tax_amount: parseFloat(totalGST.toFixed(2)),
      freight_amount: parseFloat(freightAmt.toFixed(2)),
      round_off_amount: parseFloat(roundOffAmount.toFixed(2)),
      total_amount: parseFloat(grandTotal.toFixed(2)),
      paid_amount: calculatedPaidAmount,
      adjusted_debit_amount: parseFloat(adjustedDebitAmount.toFixed(2)),
      payment_method: form.payment_method,
      payment_reference: form.payment_reference || undefined,
      items: form.items.map((it) => ({
        product_id: parseInt(it.product_id, 10),
        hsn_code: it.hsn_code ? String(it.hsn_code).trim().toUpperCase() : null,
        quantity: parseFloat(it.quantity),
        unit_cost: parseFloat(it.unit_cost),
        tax_rate: parseFloat(it.tax_rate || 0),
        tax_amount: parseFloat(it.tax_amount || 0),
        selling_price: parseFloat(it.selling_price),
        total_cost: parseFloat(it.total_cost),
        batch_number: it.batch_number ? String(it.batch_number).trim() : undefined,
        expiry_date: it.expiry_date || undefined,
      })),
    };

    try {
      const res = await apiPost('/api/v1/inventory/purchases', payload);
      if (res?.success) {
        setSuccess(`✅ Inward Stock Accepted. PO #${res.purchase?.purchase_number}. Status: ${String(res.purchase?.payment_status).toUpperCase()}.`);
        resetForm();
        await refresh();
      } else {
        setError(res?.message || 'Purchase record karne me error.');
      }
    } catch (err) {
      setError(err?.message || 'Network request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentSettledNow = form.payment_mode_selection === 'full' 
    ? payableAfterCredit 
    : form.payment_mode_selection === 'unpaid' 
    ? 0 
    : Math.min(payableAfterCredit, parseFloat(form.paid_amount || 0));

  const currentVendorBalance = Math.max(0, payableAfterCredit - currentSettledNow);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Purchase Orders & GRN (GST Compliant)</h1>
          <p className="text-sm text-zinc-400">Vendor restock receive karein, Unpaid / Partial Pay track karein, aur Input GST claim karein</p>
        </div>
        <div className="flex items-center gap-3">
          {activeBranch && (
            <span className="text-xs font-mono font-bold text-lime-400 bg-lime-400/10 border border-lime-400/20 px-3 py-1 rounded-full">
              📍 Receiving at: {activeBranch.name}
            </span>
          )}
          <Link
            to="/inventory/purchase-history"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            📜 View Purchase Ledger
          </Link>
        </div>
      </div>

      <InvNav />
      <Feedback success={success} error={error} onDismiss={() => { setSuccess(''); setError(''); }} />

      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-5 flex justify-between items-center rounded-t-2xl">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-lime-400 uppercase">GST Inward Stock Intake (GRN)</p>
            <h3 className="text-lg font-bold text-white mt-0.5">Record New Purchase Order</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">PO Reference</p>
            <p className="font-mono text-lime-400 text-sm font-bold">{form.purchase_number}</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Vendor Bill / PO No *</label>
              <input
                type="text"
                required
                value={form.purchase_number}
                onChange={(e) => setForm({ ...form, purchase_number: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Invoice Date *</label>
              <input
                type="date"
                required
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Supplier / Vendor</label>
              <select
                value={form.vendor_id}
                onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Direct / Walk-in Supplier</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.tax_id_gst ? `(GST: ${v.tax_id_gst})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* VENDOR CREDIT BALANCE NOTIFICATION BOX */}
          {vendorCreditBalance > 0 && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  💰 Available Vendor Advance Credit (Debit Note Balance)
                </span>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Is vendor ke paas pichle return ka <strong className="font-mono text-emerald-300">₹{vendorCreditBalance.toFixed(2)}</strong> balance jama hai.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-zinc-900 border border-emerald-500/40 px-3 py-1.5 rounded-lg">
                <input
                  type="checkbox"
                  checked={applyVendorCredit}
                  onChange={(e) => setApplyVendorCredit(e.target.checked)}
                  className="accent-emerald-400 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-emerald-300">Adjust in this bill</span>
              </label>
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Inventory Items (Tax Breakdown)
              </span>
              <button
                type="button"
                onClick={addRow}
                className="px-3 py-1.5 bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 border border-lime-400/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <span>+</span> Add Another Item
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((row, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl grid grid-cols-2 sm:grid-cols-6 xl:grid-cols-12 gap-3 items-end hover:border-zinc-700 transition shadow-sm relative"
                  style={{ zIndex: form.items.length - idx }}
                >
                  <div className="col-span-2 sm:col-span-6 xl:col-span-3 space-y-1.5 min-w-0">
                    <label className={labelCls}>Product Identity *</label>
                    <SearchableProductSelect
                      products={products}
                      value={row.product_id}
                      onSelect={(p) => handleProductSelect(idx, p)}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="HSN / SAC"
                        value={row.hsn_code}
                        onChange={(e) => handleRowChange(idx, 'hsn_code', e.target.value)}
                        className="w-full min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-300 placeholder-zinc-500 font-mono focus:border-lime-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Batch / Lot No"
                        value={row.batch_number}
                        onChange={(e) => handleRowChange(idx, 'batch_number', e.target.value)}
                        className="w-full min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-300 placeholder-zinc-500 font-mono focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-1 xl:col-span-1 min-w-0">
                    <label className={labelCls}>Qty *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={row.quantity}
                      onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                      className="w-full min-w-0 bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-1 text-xs font-mono font-bold text-center text-white focus:border-lime-400 focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 xl:col-span-2 min-w-0">
                    <label className={labelCls}>Expiry Date</label>
                    <input
                      type="date"
                      value={row.expiry_date ? String(row.expiry_date).split('T')[0] : ''}
                      onChange={(e) => handleRowChange(idx, 'expiry_date', e.target.value)}
                      className="w-full min-w-0 bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs font-mono tracking-tight text-zinc-200 scheme-dark focus:border-lime-400 focus:outline-none transition cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1 xl:col-span-2 min-w-0">
                    <label className={labelCls}>Buy Cost (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={row.unit_cost}
                      onChange={(e) => handleRowChange(idx, 'unit_cost', e.target.value)}
                      className="w-full min-w-0 bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-2 text-xs font-mono font-semibold text-zinc-200 focus:border-lime-400 focus:outline-none transition placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1 xl:col-span-1 min-w-0">
                    <label className={labelCls}>GST %</label>
                    <select
                      value={row.tax_rate}
                      onChange={(e) => handleRowChange(idx, 'tax_rate', e.target.value)}
                      className="w-full min-w-0 bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-1 text-xs font-bold text-lime-400 text-center cursor-pointer focus:border-lime-400 focus:outline-none transition"
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r} className="bg-zinc-900 text-white">
                          {r}%
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1 sm:col-span-1 xl:col-span-1 min-w-0">
                    <label className={labelCls}>Sell MRP (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={row.selling_price}
                      onChange={(e) => handleRowChange(idx, 'selling_price', e.target.value)}
                      className="w-full min-w-0 bg-zinc-950 border border-lime-500/40 rounded-xl py-2 px-2 text-xs font-mono font-bold text-lime-400 focus:border-lime-400 focus:outline-none transition placeholder-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2 xl:col-span-2 min-w-0 flex items-center gap-1.5">
                    <div className="flex-1 min-w-0 bg-zinc-900/95 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-right">
                      <span className="text-[9px] text-zinc-500 uppercase block font-semibold leading-tight tracking-wider">
                        Total
                      </span>
                      <span
                        className="font-bold text-white text-xs sm:text-sm font-mono block truncate"
                        title={`₹${row.total_cost || '0.00'}`}
                      >
                        ₹{row.total_cost || '0.00'}
                      </span>
                    </div>
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition shrink-0 text-xs font-bold"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Downpayment Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-zinc-800">
            {/* Payment Section */}
            <div className="md:col-span-6 space-y-4">
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">Vendor Payment Clearance</span>
                <div className="flex flex-wrap gap-4 text-xs font-medium text-zinc-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_option"
                      checked={form.payment_mode_selection === 'unpaid'}
                      onChange={() => setForm({ ...form, payment_mode_selection: 'unpaid', paid_amount: '0' })}
                      className="accent-lime-400"
                    />
                    <span>Unpaid / On Credit</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_option"
                      checked={form.payment_mode_selection === 'partial'}
                      onChange={() => setForm({ ...form, payment_mode_selection: 'partial', paid_amount: '' })}
                      className="accent-lime-400"
                    />
                    <span>Partial Payment</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_option"
                      checked={form.payment_mode_selection === 'full'}
                      onChange={() => setForm({ ...form, payment_mode_selection: 'full', paid_amount: payableAfterCredit.toFixed(2) })}
                      className="accent-lime-400"
                    />
                    <span>Full Payment (Clear Now)</span>
                  </label>
                </div>

                {form.payment_mode_selection !== 'unpaid' && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Amount Paid Now (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={payableAfterCredit}
                          placeholder="0.00"
                          disabled={form.payment_mode_selection === 'full'}
                          value={form.paid_amount}
                          onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                          className={`${inputCls} font-mono font-bold text-lime-400 disabled:opacity-75`}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Payment Method</label>
                        <select
                          value={form.payment_method}
                          onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                          className={inputCls}
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Txn Reference / Cheque No / UTR</label>
                      <input
                        type="text"
                        placeholder="e.g. UTR-9876543210"
                        value={form.payment_reference}
                        onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Additional Inward Freight (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.additional_freight}
                  onChange={(e) => setForm({ ...form, additional_freight: e.target.value })}
                  className={inputCls}
                />
                <label className="flex items-center gap-2 mt-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.round_off}
                    onChange={(e) => setForm({ ...form, round_off: e.target.checked })}
                    className="accent-lime-400 w-4 h-4"
                  />
                  Auto Round-off to nearest Rupee
                </label>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="md:col-span-6 bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-2 text-xs shadow-inner">
              <div className="flex justify-between text-zinc-400">
                <span>Taxable Amount ({form.items.length} items)</span>
                <span className="font-mono">₹{taxableSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>CGST (50%)</span>
                <span className="font-mono">₹{(totalGST / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>SGST (50%)</span>
                <span className="font-mono">₹{(totalGST / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lime-400 font-semibold">
                <span>Input GST Credit</span>
                <span className="font-mono">₹{totalGST.toFixed(2)}</span>
              </div>
              {freightAmt > 0 && (
                <div className="flex justify-between text-amber-300 font-medium">
                  <span>Inward Freight Charges</span>
                  <span className="font-mono">+₹{freightAmt.toFixed(2)}</span>
                </div>
              )}
              {form.round_off && roundOffAmount !== 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Round Off</span>
                  <span className="font-mono">{roundOffAmount >= 0 ? '+' : ''}₹{roundOffAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-zinc-800 pt-3 mt-2 flex justify-between items-center">
                <span className="font-bold text-white text-sm uppercase tracking-wide">Gross Bill Total</span>
                <span className="font-bold text-white text-2xl font-mono leading-none">₹{grandTotal.toFixed(2)}</span>
              </div>

              {/* Debit Note Credit Adjustment Row */}
              {adjustedDebitAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-400 pt-1 font-bold border-t border-dashed border-zinc-800">
                  <span>Adjusted from Vendor Credit:</span>
                  <span className="font-mono">-₹{adjustedDebitAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-zinc-300 pt-1 font-semibold">
                <span>Net Payable Balance:</span>
                <span className="font-mono text-sm">₹{payableAfterCredit.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-emerald-400 pt-1 font-semibold">
                <span>Settling Now:</span>
                <span className="font-mono">₹{currentSettledNow.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-red-400 pt-1 font-bold border-t border-zinc-900">
                <span>Outstanding Vendor Balance:</span>
                <span className="font-mono text-base">₹{currentVendorBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50">
            <button
              type="button"
              onClick={() => navigate('/inventory/purchase-history')}
              className="text-xs text-zinc-400 hover:text-white font-medium"
            >
              ← Go to Purchase History
            </button>
            <button
              type="submit"
              disabled={submitting || sharedLoading}
              className="px-8 py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-sm font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.2)]"
            >
              {submitting ? 'Processing GRN...' : '✅ Save Purchase Order & Stock Inward'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}