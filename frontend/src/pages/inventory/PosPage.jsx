import React, { useState, useMemo } from 'react';
import { apiPost } from '../../api';
import { InvNav, Feedback, useInventoryData, useBranchId, inputCls, labelCls, PAYMENT_METHODS } from './InventoryShared';

// ─── Indian Currency in Words (for Bill / Receipt) ───
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

function numberToWordsINR(amount) {
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

// ─── Professional POS Tax Invoice & Thermal Receipt Generator ───
function printPOSReceipt(saleData) {
  const { invoice, items, memberName, branchId, paymentMethod, totals } = saleData;

  const itemRows = items.map((it, idx) => {
    return `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px dashed #ddd;">
          <div style="font-weight: 600;">${it.name}</div>
          <div style="font-size: 10px; color: #666;">HSN: ${it.hsn_code || '—'} | ${it.quantity} x ₹${it.unit_price.toFixed(2)}</div>
        </td>
        <td style="text-align: right; padding: 6px 0; border-bottom: 1px dashed #ddd; vertical-align: top; font-weight: 600;">
          ₹${it.total_price.toFixed(2)}
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice - ${invoice.invoice_number}</title>
      <style>
        * { box-sizing: border-box; font-family: 'Courier New', Courier, monospace; }
        body { margin: 0; padding: 10px; font-size: 12px; color: #000; width: 300px; margin: 0 auto; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .dashed { border-top: 1px dashed #000; margin: 8px 0; }
        .bold { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .totals-row { display: flex; justify-content: space-between; padding: 2px 0; }
        @media print {
          body { width: 100%; padding: 0; }
          @page { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="text-center">
        <h2 style="margin: 0; font-size: 16px; font-weight: bold;">GYM STORE / POS COUNTER</h2>
        <div style="font-size: 10px; margin-top: 2px;">Branch #${branchId}</div>
        <div style="font-size: 10px;">RETAIL TAX INVOICE</div>
      </div>
      <div class="dashed"></div>
      <div style="font-size: 11px;">
        <div>Inv No: <span class="bold">${invoice.invoice_number}</span></div>
        <div>Date: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
        <div>Customer: ${memberName || 'Walk-in Guest'}</div>
        <div>Payment: ${paymentMethod.toUpperCase()}</div>
      </div>
      <div class="dashed"></div>
      <table>
        <thead>
          <tr>
            <th style="text-align: left; padding-bottom: 4px;">Item Description</th>
            <th style="text-align: right; padding-bottom: 4px;">Amt (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      <div class="dashed"></div>
      <div>
        <div class="totals-row"><span>Taxable Base:</span><span>₹${totals.taxableSubtotal.toFixed(2)}</span></div>
        <div class="totals-row"><span>CGST (50%):</span><span>₹${(totals.totalTax / 2).toFixed(2)}</span></div>
        <div class="totals-row"><span>SGST (50%):</span><span>₹${(totals.totalTax / 2).toFixed(2)}</span></div>
        <div class="totals-row"><span>Total GST Amount:</span><span>₹${totals.totalTax.toFixed(2)}</span></div>
        ${totals.discount > 0 ? `<div class="totals-row"><span>Discount:</span><span>- ₹${totals.discount.toFixed(2)}</span></div>` : ''}
        ${totals.roundOff !== 0 ? `<div class="totals-row"><span>Round Off:</span><span>${totals.roundOff >= 0 ? '+' : ''}₹${totals.roundOff.toFixed(2)}</span></div>` : ''}
        <div class="dashed"></div>
        <div class="totals-row" style="font-size: 14px; font-weight: bold;">
          <span>GRAND TOTAL:</span>
          <span>₹${parseFloat(invoice.total_amount).toFixed(2)}</span>
        </div>
      </div>
      <div class="dashed"></div>
      <div style="font-size: 10px; font-style: italic;" class="text-center">
        ${numberToWordsINR(invoice.total_amount)}
      </div>
      <div class="dashed"></div>
      <div class="text-center" style="font-size: 10px; margin-top: 10px;">
        Thank You For Shopping With Us!<br />
        Goods once sold are subject to store return policy.
      </div>
      <script>
        window.onload = () => { window.print(); };
      </script>
    </body>
    </html>
  `;

  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(html);
  w.document.close();
}

export default function PosPage() {
  const { products, members, loading, refresh } = useInventoryData();
  const getBranchId = useBranchId();
  const branchId = getBranchId();

  const [searchTerm, setSearchTerm] = useState('');
  const [memberId, setMemberId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState('0');
  const [cart, setCart] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-POS-${Date.now().toString().slice(-6)}`);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  // ─── Filter Products by Name, SKU, or Barcode ───
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return products.filter((p) => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.hsn_code && p.hsn_code.toLowerCase().includes(q))
    );
  }, [products, searchTerm]);

  // ─── Add Product to Cart with Exact HSN and Tax Attributes ───
  const addToCart = (p) => {
    const available = parseFloat(p.current_stock || 0);
    if (available <= 0) return;

    const mrp = parseFloat(p.selling_price || 0);
    const taxRate = parseFloat(p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : 18);
    const hsnCode = p.hsn_code || '';

    const idx = cart.findIndex((c) => c.product_id === p.product_id);
    if (idx > -1) {
      if (cart[idx].quantity + 1 > available) {
        setError(`Stock limit reached for ${p.name}. Only ${available} available.`);
        return;
      }
      const updated = [...cart];
      updated[idx].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          product_id: p.product_id,
          name: p.name,
          sku: p.sku,
          hsn_code: hsnCode,
          tax_rate: taxRate,
          unit_price: mrp, // Retail Selling MRP (Inclusive of Tax)
          quantity: 1,
          available_stock: available,
        },
      ]);
    }
    setError('');
  };

  const updateQty = (idx, val) => {
    const qty = parseFloat(val);
    if (isNaN(qty) || qty <= 0) return;
    if (qty > cart[idx].available_stock) {
      setError(`Stock limit reached! Max available: ${cart[idx].available_stock}`);
      return;
    }
    const updated = [...cart];
    updated[idx].quantity = qty;
    setCart(updated);
    setError('');
  };

  const updatePriceOverride = (idx, val) => {
    const price = parseFloat(val);
    if (isNaN(price) || price < 0) return;
    const updated = [...cart];
    updated[idx].unit_price = price;
    setCart(updated);
  };

  const removeFromCart = (idx) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  // ─── GST Mathematical Calculations (GST Inclusive Backward Formula) ───
  // Gross Amount = Qty * Unit Selling Price
  // Taxable Base = Gross / (1 + (Rate / 100))
  // GST Amount   = Gross - Taxable Base
  const cartCalculations = useMemo(() => {
    let grossTotal = 0;
    let taxableSubtotal = 0;
    let totalTax = 0;

    const lineCalculations = cart.map((item) => {
      const lineGross = item.unit_price * item.quantity;
      const rate = item.tax_rate || 0;
      const lineTaxable = rate > 0 ? (lineGross / (1 + rate / 100)) : lineGross;
      const lineTax = lineGross - lineTaxable;

      grossTotal += lineGross;
      taxableSubtotal += lineTaxable;
      totalTax += lineTax;

      return {
        ...item,
        lineGross,
        lineTaxable,
        lineTax,
      };
    });

    const discountAmt = Math.min(grossTotal, parseFloat(discount) || 0);
    const preRoundNet = Math.max(0, grossTotal - discountAmt);
    const roundOff = Math.round(preRoundNet) - preRoundNet;
    const grandTotal = preRoundNet + roundOff;

    return {
      lineCalculations,
      grossTotal,
      taxableSubtotal,
      totalTax,
      discountAmt,
      roundOff,
      grandTotal,
    };
  }, [cart, discount]);

  // ─── POS Checkout Submission ───
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Cart is empty. Add products to bill.');
      return;
    }

    setSubmitting(true);
    setSuccess('');
    setError('');

    const payload = {
      branch_id: branchId,
      member_id: memberId ? parseInt(memberId, 10) : null,
      invoice_number: invoiceNumber.trim(),
      subtotal: parseFloat(cartCalculations.taxableSubtotal.toFixed(2)),
      tax_amount: parseFloat(cartCalculations.totalTax.toFixed(2)),
      discount_amount: parseFloat(cartCalculations.discountAmt.toFixed(2)),
      round_off_amount: parseFloat(cartCalculations.roundOff.toFixed(2)),
      total_amount: parseFloat(cartCalculations.grandTotal.toFixed(2)),
      payment_method: paymentMethod,
      items: cartCalculations.lineCalculations.map((i) => ({
        product_id: i.product_id,
        hsn_code: i.hsn_code || null,
        description: `${i.name} (${i.sku})`,
        quantity: i.quantity,
        unit_price: i.unit_price,
        tax_rate: i.tax_rate,
        tax_amount: parseFloat(i.lineTax.toFixed(2)),
        discount_amount: 0,
        total_price: parseFloat(i.lineGross.toFixed(2)),
      })),
    };

    const res = await apiPost('/api/v1/inventory/pos-sale', payload);

    if (res?.success) {
      const selectedMember = members.find((m) => String(m.id) === String(memberId));
      const memberFullName = selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name || ''} (${selectedMember.member_code})` : 'Walk-in Guest';

      const receiptPayload = {
        invoice: res.invoice,
        items: cart.map((c) => ({
          name: c.name,
          sku: c.sku,
          hsn_code: c.hsn_code,
          quantity: c.quantity,
          unit_price: c.unit_price,
          total_price: c.unit_price * c.quantity,
        })),
        memberName: memberFullName,
        branchId,
        paymentMethod,
        totals: {
          taxableSubtotal: cartCalculations.taxableSubtotal,
          totalTax: cartCalculations.totalTax,
          discount: cartCalculations.discountAmt,
          roundOff: cartCalculations.roundOff,
        },
      };

      setLastSaleReceipt(receiptPayload);
      setSuccess(`✅ Sale complete! Invoice ${res.invoice?.invoice_number} created for ₹${parseFloat(res.invoice?.total_amount).toFixed(2)} via ${paymentMethod.toUpperCase()}`);

      // Reset Form
      setCart([]);
      setDiscount('0');
      setMemberId('');
      setInvoiceNumber(`INV-POS-${Date.now().toString().slice(-6)}`);
      refresh();
    } else {
      setError(res?.message || 'POS Checkout submission failed.');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">POS Billing Terminal</h1>
          <p className="text-sm text-zinc-400">GST-ready counter sale — instant tax invoice, split GST booking, aur real-time stock deduction</p>
        </div>
        {lastSaleReceipt && (
          <button
            type="button"
            onClick={() => printPOSReceipt(lastSaleReceipt)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-lime-500/30 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2 self-start shadow-md"
          >
            🖨️ Re-Print Last Receipt
          </button>
        )}
      </div>

      <InvNav />
      <Feedback success={success} error={error} onDismiss={() => { setSuccess(''); setError(''); }} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT: PRODUCT CATALOG CATALOG & QUICK SEARCH (7 Cols) ─── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 text-xs">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search catalog by Name, SKU, HSN, or Barcode..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition"
              />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 rounded-lg whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-16 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800 text-sm">
              Loading Catalog Items...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const stock = parseFloat(p.current_stock || 0);
                const mrp = parseFloat(p.selling_price || 0);
                const gstRate = p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : 18;
                const isOutOfStock = stock <= 0;

                return (
                  <button
                    key={p.product_id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={isOutOfStock}
                    className="text-left p-3.5 bg-zinc-900 border border-zinc-800 hover:border-lime-400/50 rounded-2xl transition disabled:opacity-30 disabled:pointer-events-none relative overflow-hidden group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center gap-1">
                        <span className="font-mono text-[9.5px] text-lime-400 font-bold uppercase tracking-wider">{p.sku}</span>
                        <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1 rounded">GST {gstRate}%</span>
                      </div>
                      <h4 className="font-bold text-white text-xs mt-1 leading-snug line-clamp-2" title={p.name}>
                        {p.name}
                      </h4>
                      {p.hsn_code && <p className="text-[9px] text-zinc-500 font-mono mt-0.5">HSN: {p.hsn_code}</p>}
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-zinc-800/80">
                      <div>
                        <span className="font-bold text-white text-sm">
                          {mrp > 0 ? `₹${mrp.toFixed(0)}` : <span className="text-[10px] text-amber-500">Unpriced</span>}
                        </span>
                        <span className="block text-[8.5px] text-zinc-500">Incl. Taxes</span>
                      </div>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          stock <= 0
                            ? 'bg-zinc-800 text-zinc-500'
                            : stock <= 5
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {stock <= 0 ? 'Out' : `${stock} left`}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-zinc-500 text-xs bg-zinc-900 rounded-2xl border border-dashed border-zinc-800">
                  Koi item match nahi hua "{searchTerm}" ke liye.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── RIGHT: BILLING TERMINAL & CHECKOUT CART (5 Cols) ─── */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl sticky top-6">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-lime-400">Checkout Terminal</p>
              <h3 className="text-sm font-bold text-white">Active Sale Invoice</h3>
            </div>
            <span className="text-xs font-mono text-lime-400 bg-lime-400/10 px-2 py-1 rounded-lg border border-lime-400/20">
              {invoiceNumber}
            </span>
          </div>

          {/* Customer Association */}
          <div>
            <label className={labelCls}>Customer / Gym Member (Optional)</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className={inputCls}
            >
              <option value="">Walk-in Guest / Counter Sale</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_code} — {m.first_name} {m.last_name || ''} ({m.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Cart Items List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {cartCalculations.lineCalculations.map((item, idx) => (
              <div key={item.product_id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white text-xs truncate max-w-[210px]">{item.name}</p>
                    <p className="text-[9.5px] text-zinc-500 font-mono">
                      SKU: {item.sku} {item.hsn_code ? `| HSN: ${item.hsn_code}` : ''} | GST: {item.tax_rate}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(idx)}
                    className="text-zinc-500 hover:text-red-400 text-xs font-bold transition"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
                  <div className="flex flex-col">
                    <span className="text-[8.5px] text-zinc-500 uppercase font-bold">Qty</span>
                    <input
                      type="number"
                      min="1"
                      max={item.available_stock}
                      value={item.quantity}
                      onChange={(e) => updateQty(idx, e.target.value)}
                      className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-center text-xs font-bold text-white focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[8.5px] text-zinc-500 uppercase font-bold">Price (₹)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updatePriceOverride(idx, e.target.value)}
                      className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-lime-400 focus:border-lime-400 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="ml-auto text-right flex flex-col">
                    <span className="text-[8.5px] text-zinc-500 uppercase font-bold">
                      Tax ₹{item.lineTax.toFixed(2)}
                    </span>
                    <span className="font-bold text-white text-sm font-mono">
                      ₹{item.lineGross.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="py-12 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl space-y-1">
                <span className="text-xl block">🛒</span>
                <p>Cart khali hai.</p>
                <p className="text-[10px] text-zinc-600">Left side se kisi bhi product par click karein.</p>
              </div>
            )}
          </div>

          {/* Checkout & GST Calculations Summary */}
          {cart.length > 0 && (
            <form onSubmit={handleCheckout} className="space-y-3 pt-3 border-t border-zinc-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Spot Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Payment Mode *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={inputCls}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m.replace(/_/g, ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tax & Total Details */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-1.5 text-xs shadow-inner">
                <div className="flex justify-between text-zinc-400">
                  <span>Gross Product Total</span>
                  <span className="font-mono">₹{cartCalculations.grossTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Taxable Base Value</span>
                  <span className="font-mono">₹{cartCalculations.taxableSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>CGST (Intra-state 50%)</span>
                  <span className="font-mono">₹{(cartCalculations.totalTax / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>SGST (Intra-state 50%)</span>
                  <span className="font-mono">₹{(cartCalculations.totalTax / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lime-400 font-semibold">
                  <span>Total Output GST</span>
                  <span className="font-mono">₹{cartCalculations.totalTax.toFixed(2)}</span>
                </div>

                {cartCalculations.discountAmt > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Discount Deducted</span>
                    <span className="font-mono">- ₹{cartCalculations.discountAmt.toFixed(2)}</span>
                  </div>
                )}

                {cartCalculations.roundOff !== 0 && (
                  <div className="flex justify-between text-zinc-500">
                    <span>Round Off</span>
                    <span className="font-mono">
                      {cartCalculations.roundOff >= 0 ? '+' : ''}₹{cartCalculations.roundOff.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="border-t border-zinc-800 pt-2.5 mt-2 flex justify-between items-center font-bold">
                  <span className="text-white text-sm uppercase tracking-wider">Net Amount Payable</span>
                  <span className="text-lime-400 text-2xl font-mono leading-none">
                    ₹{cartCalculations.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm uppercase tracking-wider rounded-xl disabled:opacity-50 transition shadow-[0_0_15px_rgba(163,230,53,0.3)] flex justify-center items-center gap-2"
              >
                {submitting ? 'Generating Invoice...' : '💳 Collect Payment & Print Bill'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}