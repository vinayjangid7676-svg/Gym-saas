import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api';
import { useBranch } from '../context/BranchContext';

const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none transition';
const labelCls = 'text-xs text-zinc-400 block mb-1.5 font-semibold tracking-wide uppercase';
const PAYMENT_METHODS = ['cash', 'upi_qr', 'pos_machine', 'razorpay', 'stripe', 'bank_transfer', 'cheque', 'other'];

const emptyItem = () => ({
  item_type: 'membership',
  reference_id: '',
  trainer_id: '',
  class_schedule_id: '',
  description: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  quantity: 1,
  unit_price: '',
  discount_amount: '0',
  tax_rate: '0',
  tax_amount: '0',
  hsn_code: '',
  batch_number: '',
  expiry_date: '',
  available_stock: 0,
  unit: 'piece',
  available_batches: [],
  locker_security_deposit: 0,
  locker_monthly_rent: 0,
  class_name: '',
  trainer_name: '',
  timing_label: '',
  class_capacity: '',
});

// Indian Numbering System for Words
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

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { activeBranch, loading: branchLoading } = useBranch();

  // Dynamic States
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [lockers, setLockers] = useState([]);
  const [ptPlans, setPtPlans] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [addons, setAddons] = useState([]);
  const [classSchedules, setClassSchedules] = useState([]);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(true);

  const [formData, setFormData] = useState({
    member_id: '',
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
    due_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState([emptyItem()]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState({ type: '', text: '' });
  const [includePayment, setIncludePayment] = useState(true);
  const [payment, setPayment] = useState({ amount: '', payment_method: 'cash', transaction_reference: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // ─── Live Dynamic Items (Inventory, Lockers, Classes, Staff) ───
  const fetchBranchDynamicData = useCallback(async (targetBranchId) => {
    if (!targetBranchId) return;
    try {
      const bParam = `?branch_id=${targetBranchId}`;
      const [productsRes, lockersRes, schedulesRes, staffRes, membersRes] = await Promise.all([
        apiGet(`/api/v1/inventory/stock${bParam}`).catch(() => ({ success: false, stock: [] })),
        apiGet(`/api/v1/lockers${bParam}`).catch(() => ({ success: false, data: [] })),
        apiGet(`/api/v1/classes/schedules${bParam}`).catch(() => ({ success: false, data: [] })),
        apiGet(`/api/v1/staff${bParam}`).catch(() => ({ success: false, data: [] })),
        apiGet(`/api/v1/members${bParam}&limit=1000`).catch(() => ({ success: false, data: [] }))
      ]);

      if (productsRes?.success) setProducts(productsRes.stock || []);
      if (lockersRes?.success) setLockers(lockersRes.data || []);
      if (staffRes?.success) setTrainers(staffRes.data || []);
      if (membersRes?.success) setMembers(membersRes.data || []);

      if (schedulesRes?.success && schedulesRes.data?.length > 0) {
        setClassSchedules(schedulesRes.data);
      } else {
        const fallbackRes = await apiGet('/api/v1/classes/schedules').catch(() => ({ success: false, data: [] }));
        if (fallbackRes?.success) setClassSchedules(fallbackRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching live branch data:', err);
    }
  }, []);

  // ─── Initial Global Master Data Load ───
  useEffect(() => {
    const fetchGlobalData = async () => {
      setGlobalLoading(true);
      try {
        const [plansRes, ptRes, addonsRes, promoRes] = await Promise.all([
          apiGet('/api/v1/plans').catch(() => ({ success: false, data: [] })),
          apiGet('/api/v1/pt/plans').catch(() => ({ success: false, data: [] })),
          apiGet('/api/v1/addons').catch(() => ({ success: false, data: [] })),
          apiGet('/api/v1/discounts/promotions').catch(() => ({ success: false, data: { coupons: [] } })),
        ]);
        if (plansRes?.success) setPlans(plansRes.data || []);
        if (ptRes?.success) setPtPlans(ptRes.data || []);
        if (addonsRes?.success) setAddons(addonsRes.addons || addonsRes.data || []);
        if (promoRes?.success) setAvailableCoupons(promoRes.data?.coupons || []);
      } catch (err) {
        console.error('Global data fetch failed:', err);
      } finally {
        setGlobalLoading(false);
      }
    };
    fetchGlobalData();
  }, []);

  // ─── REACTIVE ZERO-REFRESH BRANCH LISTENER ───
  useEffect(() => {
    if (activeBranch?.id) {
      fetchBranchDynamicData(activeBranch.id);
      // Agar branch change hui toh cart row items reset karein taaki mismatch stock/locker na rahe
      setItems([emptyItem()]);
    }
  }, [activeBranch?.id, fetchBranchDynamicData]);

  // Global window event listener (in case branch changes from anywhere)
  useEffect(() => {
    const handleBranchSwitchEvent = (e) => {
      const switchedBranchId = e.detail?.branchId;
      if (switchedBranchId) {
        fetchBranchDynamicData(switchedBranchId);
        setItems([emptyItem()]);
      }
    };

    window.addEventListener('branchChanged', handleBranchSwitchEvent);
    return () => window.removeEventListener('branchChanged', handleBranchSwitchEvent);
  }, [fetchBranchDynamicData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleCategoryChange = (idx, newCategory) => {
    const updated = [...items];
    updated[idx] = {
      ...emptyItem(),
      item_type: newCategory,
      start_date: updated[idx].start_date,
    };
    setItems(updated);
  };

  // ─── Reference Auto-Binding ───
  const handleReferenceSelect = (idx, referenceId) => {
    const updated = [...items];
    const type = updated[idx].item_type;
    updated[idx].reference_id = referenceId;

    if (!referenceId) {
      updated[idx].description = '';
      updated[idx].unit_price = '';
      updated[idx].tax_rate = '0';
      updated[idx].tax_amount = '0';
      setItems(updated);
      return;
    }

    if (type === 'membership') {
      const plan = plans.find((p) => String(p.id) === String(referenceId));
      if (plan) {
        const basePrice = parseFloat(plan.base_price || 0);
        const taxRate = parseFloat(plan.tax_percentage || 0);
        updated[idx].description = `Membership: ${plan.name} (${plan.duration_days} Days)`;
        updated[idx].unit_price = basePrice.toFixed(2);
        updated[idx].tax_rate = taxRate.toString();
        updated[idx].tax_amount = ((basePrice * taxRate) / 100).toFixed(2);
      }
    } else if (type === 'class_enrollment') {
      const schedule = classSchedules.find((s) => String(s.id) === String(referenceId));
      if (schedule) {
        const start = new Date(schedule.start_time);
        const end = new Date(schedule.end_time);
        const timeStr = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const resolvedPrice = parseFloat(schedule.class_price !== undefined ? schedule.class_price : 0);

        updated[idx].class_schedule_id = schedule.id;
        updated[idx].description = `Class Pass: ${schedule.class_name} (${timeStr})`;
        updated[idx].unit_price = resolvedPrice.toFixed(2);
        updated[idx].tax_rate = '0';
        updated[idx].tax_amount = '0.00';
        updated[idx].class_name = schedule.class_name;
        updated[idx].trainer_name = schedule.trainer_name || 'Staff Instructor';
        updated[idx].timing_label = `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${timeStr}`;
        updated[idx].class_capacity = `${schedule.booked_count}/${schedule.max_capacity} Booked`;
        updated[idx].start_date = start.toISOString().split('T')[0];
      }
    } else if (type === 'addon') {
      const addon = addons.find((a) => String(a.id) === String(referenceId));
      if (addon) {
        updated[idx].description = `Add-on: ${addon.name}`;
        updated[idx].unit_price = parseFloat(addon.price || 0).toFixed(2);
        updated[idx].tax_rate = '0';
        updated[idx].tax_amount = '0.00';
      }
    } else if (type === 'product') {
      const product = products.find((p) => String(p.product_id ?? p.id) === String(referenceId));
      if (product) {
        const price = parseFloat(product.selling_price || 0);
        const taxRate = parseFloat(product.tax_rate !== undefined && product.tax_rate !== null ? product.tax_rate : 18);
        const exactStock = Number(product.current_stock ?? 0);
        updated[idx].description = `${product.name} (${product.sku})`;
        updated[idx].unit_price = price.toFixed(2);
        updated[idx].hsn_code = product.hsn_code || '2106';
        updated[idx].tax_rate = taxRate.toString();
        updated[idx].unit = product.unit || 'piece';
        updated[idx].available_stock = exactStock;
        const batches = product.available_batches || [];
        updated[idx].available_batches = batches;
        if (batches.length > 0) {
          updated[idx].batch_number = batches[0].batch_number || 'DEFAULT-LOT';
          updated[idx].expiry_date = batches[0].expiry_date ? batches[0].expiry_date.split('T')[0] : '';
        }
        const lineGross = price * (parseFloat(updated[idx].quantity) || 1);
        const lineTaxable = taxRate > 0 ? lineGross / (1 + taxRate / 100) : lineGross;
        updated[idx].tax_amount = (lineGross - lineTaxable).toFixed(2);
      }
    } else if (type === 'locker') {
      const locker = lockers.find((l) => String(l.id) === String(referenceId));
      if (locker) {
        const monthlyRent = parseFloat(locker.effective_monthly_rent || locker.monthly_rent || 0);
        const deposit = parseFloat(locker.effective_security_deposit || locker.security_deposit || 0);
        const qtyMonths = parseFloat(updated[idx].quantity) || 1;
        updated[idx].description = `Locker Allocation: Unit #${locker.locker_number}`;
        updated[idx].unit_price = monthlyRent.toFixed(2);
        updated[idx].locker_monthly_rent = monthlyRent;
        updated[idx].locker_security_deposit = deposit;
        updated[idx].tax_rate = '0';
        updated[idx].tax_amount = '0.00';
        const startDate = new Date(updated[idx].start_date || new Date());
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + qtyMonths);
        updated[idx].end_date = endDate.toISOString().split('T')[0];
      }
    } else if (type === 'pt_session') {
      const pt = ptPlans.find((p) => String(p.id) === String(referenceId));
      if (pt) {
        updated[idx].description = `PT: ${pt.name} (${pt.session_count} Sessions)`;
        updated[idx].unit_price = parseFloat(pt.price || 0).toFixed(2);
        updated[idx].tax_rate = '0';
        updated[idx].tax_amount = '0.00';
        if (trainers.length > 0 && !updated[idx].trainer_id) {
          updated[idx].trainer_id = trainers[0].id || trainers[0].user_id;
        }
      }
    }
    setItems(updated);
  };

  const handleTrainerSelect = (idx, trainerId) => {
    const updated = [...items];
    updated[idx].trainer_id = trainerId;
    setItems(updated);
  };

  const handleItemFieldChange = (idx, e) => {
    const { name, value } = e.target;
    const updated = [...items];
    updated[idx] = { ...updated[idx], [name]: value };

    if (updated[idx].item_type === 'product' && ['quantity', 'unit_price', 'tax_rate'].includes(name)) {
      const qty = parseFloat(name === 'quantity' ? value : updated[idx].quantity) || 0;
      const price = parseFloat(name === 'unit_price' ? value : updated[idx].unit_price) || 0;
      const rate = parseFloat(name === 'tax_rate' ? value : updated[idx].tax_rate) || 0;
      const gross = qty * price;
      const taxable = rate > 0 ? gross / (1 + rate / 100) : gross;
      updated[idx].tax_amount = (gross - taxable).toFixed(2);
    } else if (['quantity', 'unit_price', 'tax_rate'].includes(name)) {
      const qty = parseFloat(name === 'quantity' ? value : updated[idx].quantity) || 0;
      const price = parseFloat(name === 'unit_price' ? value : updated[idx].unit_price) || 0;
      const rate = parseFloat(name === 'tax_rate' ? value : updated[idx].tax_rate) || 0;
      const base = qty * price;
      updated[idx].tax_amount = ((base * rate) / 100).toFixed(2);
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  // ─── Total Calculations ───
  const calc = useMemo(() => {
    let grossAccumulator = 0;
    let taxableAccumulator = 0;
    let totalTax = 0;

    const rows = items.map((it) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const disc = parseFloat(it.discount_amount) || 0;
      const taxRate = parseFloat(it.tax_rate) || 0;
      let lineGross = 0;
      let lineTaxable = 0;
      let lineTax = 0;
      let total = 0;

      if (it.item_type === 'product') {
        lineGross = qty * price;
        lineTaxable = taxRate > 0 ? lineGross / (1 + taxRate / 100) : lineGross;
        lineTax = lineGross - lineTaxable;
        total = Math.max(0, lineGross - disc);
      } else {
        lineTaxable = qty * price;
        lineTax = (lineTaxable * taxRate) / 100;
        lineGross = lineTaxable + lineTax;
        total = Math.max(0, lineTaxable - disc + lineTax);
      }

      grossAccumulator += lineGross;
      taxableAccumulator += lineTaxable;
      totalTax += lineTax;

      return {
        ...it,
        qty,
        price,
        disc,
        tax: lineTax,
        taxRate,
        lineTaxable,
        total,
      };
    });

    const itemDiscounts = rows.reduce((s, r) => s + r.disc, 0);
    let couponDiscountAmount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === 'percentage') {
        couponDiscountAmount = (taxableAccumulator * parseFloat(appliedCoupon.discount_value)) / 100;
      } else {
        couponDiscountAmount = parseFloat(appliedCoupon.discount_value || 0);
      }
      couponDiscountAmount = Math.min(couponDiscountAmount, taxableAccumulator);
    }

    const totalDiscount = itemDiscounts + couponDiscountAmount;
    const preRoundNet = Math.max(0, grossAccumulator - totalDiscount);
    const roundOff = Math.round(preRoundNet) - preRoundNet;
    const grandTotal = preRoundNet + roundOff;

    return {
      rows,
      subtotal: taxableAccumulator,
      grossTotal: grossAccumulator,
      itemDiscounts,
      couponDiscountAmount,
      totalDiscount,
      totalTax,
      cgst: totalTax / 2,
      sgst: totalTax / 2,
      roundOff,
      grandTotal,
    };
  }, [items, appliedCoupon]);

  useEffect(() => {
    if (includePayment && (!payment.amount || parseFloat(payment.amount) !== calc.grandTotal)) {
      setPayment((prev) => ({ ...prev, amount: calc.grandTotal.toFixed(2) }));
    }
  }, [calc.grandTotal, includePayment]);

  const handleVerifyCoupon = () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponMessage({ type: '', text: '' });
    const code = couponCode.trim().toUpperCase();
    const found = availableCoupons.find((c) => c.code === code && c.is_active);
    if (!found) {
      setCouponMessage({ type: 'error', text: 'Coupon code invalid ya inactive hai.' });
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    setAppliedCoupon(found);
    setCouponMessage({
      type: 'success',
      text: `Coupon verified: ${found.discount_type === 'percentage' ? `${found.discount_value}% OFF` : `₹${found.discount_value} FLAT OFF`}`,
    });
    setCouponLoading(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.member_id) {
      setError('Please select a member first.');
      return;
    }

    if (!activeBranch?.id) {
      setError('Active branch detect nahi hui.');
      return;
    }

    setSubmitLoading(true);
    setError('');
    setResult(null);

    const payload = {
      branch_id: parseInt(activeBranch.id, 10), // Automatically binds current active facility
      member_id: parseInt(formData.member_id, 10),
      invoice_number: formData.invoice_number.trim(),
      due_date: formData.due_date || undefined,
      notes: formData.notes || undefined,
      subtotal: parseFloat(calc.subtotal.toFixed(2)),
      discount_amount: parseFloat(calc.totalDiscount.toFixed(2)),
      tax_amount: parseFloat(calc.totalTax.toFixed(2)),
      round_off_amount: parseFloat(calc.roundOff.toFixed(2)),
      total_amount: parseFloat(calc.grandTotal.toFixed(2)),
      coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
      items: calc.rows.map((r) => ({
        item_type: r.item_type,
        reference_id: r.reference_id ? parseInt(r.reference_id, 10) : undefined,
        trainer_id: r.trainer_id ? parseInt(r.trainer_id, 10) : undefined,
        class_schedule_id: r.class_schedule_id ? parseInt(r.class_schedule_id, 10) : undefined,
        description: r.description,
        start_date: r.start_date || undefined,
        end_date: r.end_date || undefined,
        quantity: r.qty,
        unit_price: r.price,
        tax_rate: r.taxRate,
        tax_amount: parseFloat(r.tax.toFixed(2)),
        discount_amount: r.disc,
        total_price: parseFloat(r.total.toFixed(2)),
        batch_number: r.batch_number || undefined,
        expiry_date: r.expiry_date || undefined,
        hsn_code: r.hsn_code || undefined,
        locker_security_deposit: r.locker_security_deposit || 0,
      })),
    };

    if (includePayment && parseFloat(payment.amount) > 0) {
      payload.initial_payment = {
        amount: parseFloat(payment.amount),
        payment_method: payment.payment_method,
        transaction_reference: payment.transaction_reference || undefined,
      };
    }

    const res = await apiPost('/api/v1/billing/invoices', payload);
    if (res?.success) {
      setResult(res.data);
      fetchBranchDynamicData(activeBranch.id);
    } else {
      setError(res?.message || 'Invoice generate karne me issue aayi.');
    }
    setSubmitLoading(false);
  };

  const resetForm = () => {
    setFormData((prev) => ({
      ...prev,
      member_id: '',
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      notes: '',
    }));
    setItems([emptyItem()]);
    handleRemoveCoupon();
    setResult(null);
    setError('');
  };

  if (globalLoading || branchLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-400 text-sm animate-pulse">Syncing POS Terminal with active branch...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">POS Billing Terminal & Tax Invoicing</h1>
          <p className="text-sm text-zinc-400">
            Real-time billing context synced with <strong className="text-white">{activeBranch?.name || 'Main Facility'}</strong>.
          </p>
        </div>

        {/* Live Facility Context Indicator (Zero Manual Selection) */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping"></span>
          <span className="text-xs text-zinc-400">Billing At:</span>
          <span className="text-xs font-mono font-bold text-lime-400 uppercase">
            {activeBranch?.name} ({activeBranch?.code || 'ACTIVE'})
          </span>
        </div>
      </div>

      {result ? (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-2xl">🎉</div>
            <div>
              <h3 className="text-xl font-bold text-emerald-400">Tax Invoice Generated & Sale Finalized!</h3>
              <p className="text-sm text-zinc-400">Memberships, PT sessions, lockers, and inventory accounts have been synchronized.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-950 p-5 rounded-xl border border-zinc-800">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Invoice #</p>
              <p className="font-mono text-lime-400 font-bold">{result.invoice_number}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Payment Status</p>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                {result.payment_status}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Grand Total</p>
              <p className="text-white font-bold text-lg font-mono">₹{parseFloat(result.total_amount).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Settled Amount</p>
              <p className="text-lime-400 font-bold text-lg font-mono">₹{result.payment ? parseFloat(result.payment.amount).toFixed(2) : '0.00'}</p>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-zinc-800/50">
            <button
              onClick={resetForm}
              className="px-6 py-3 rounded-xl text-sm bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold transition shadow-sm"
            >
              + Process Next Invoice
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="px-6 py-3 rounded-xl text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition"
            >
              Go to Billing History
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl px-4 py-3">{error}</div>}

          {/* Master Information (Zero Manual Branch Dropdown) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4 border-b border-zinc-800/60">
            <div className="md:col-span-8">
              <label className={labelCls}>Select Customer / Gym Member *</label>
              <select name="member_id" required value={formData.member_id} onChange={handleChange} className={inputCls}>
                <option value="">-- Choose Member Enrolled in {activeBranch?.name} --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.member_code} — {m.first_name} {m.last_name || ''} ({m.phone})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className={labelCls}>Tax Invoice Reference *</label>
              <input type="text" name="invoice_number" required value={formData.invoice_number} onChange={handleChange} className={`${inputCls} font-mono text-lime-400`} />
            </div>
          </div>

          {/* Cart & Line Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Billed Line Items</h4>
              <button
                type="button"
                onClick={addItem}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-lime-400 font-bold border border-zinc-700 transition"
              >
                + Add Item Row
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="border border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 transition-colors rounded-2xl p-5 space-y-4 relative">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="absolute top-4 right-4 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded-lg font-bold transition"
                    >
                      Remove
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pr-12">
                    <div className="md:col-span-3">
                      <label className={labelCls}>Item Category</label>
                      <select
                        name="item_type"
                        value={item.item_type}
                        onChange={(e) => handleCategoryChange(idx, e.target.value)}
                        className={`${inputCls} font-medium`}
                      >
                        <option value="membership">Membership Plan</option>
                        <option value="pt_session">Personal Training (PT)</option>
                        <option value="class_enrollment">Group Class (Studio Pass)</option>
                        <option value="addon">Add-on Service</option>
                        <option value="product">Supplement / Product (Inventory)</option>
                        <option value="locker">Locker Rental</option>
                        <option value="other">Custom Charge</option>
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      {item.item_type === 'membership' && (
                        <div>
                          <label className={labelCls}>Select Membership Package *</label>
                          <select required value={item.reference_id} onChange={(e) => handleReferenceSelect(idx, e.target.value)} className={inputCls}>
                            <option value="">-- Choose Membership Plan --</option>
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.duration_days} Days) - ₹{p.base_price}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {item.item_type === 'pt_session' && (
                        <div className="space-y-3">
                          <div>
                            <label className={labelCls}>Select PT Package *</label>
                            <select required value={item.reference_id} onChange={(e) => handleReferenceSelect(idx, e.target.value)} className={inputCls}>
                              <option value="">-- Choose PT Package --</option>
                              {ptPlans.map((pt) => (
                                <option key={pt.id} value={pt.id}>
                                  {pt.name} ({pt.session_count} Sessions • {pt.validity_days || 30} Days) - ₹{pt.price}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Assign Coach ({activeBranch?.name}) *</label>
                            <select
                              required
                              value={item.trainer_id}
                              onChange={(e) => handleTrainerSelect(idx, e.target.value)}
                              className={`${inputCls} text-lime-400 font-semibold`}
                            >
                              <option value="">-- Select Coach --</option>
                              {trainers.map((t) => (
                                <option key={t.id || t.user_id} value={t.id || t.user_id}>
                                  {t.name || t.employee_code} ({t.designation || 'Coach'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {item.item_type === 'class_enrollment' && (
                        <div>
                          <label className={labelCls}>Select Class Batch & Timing ({activeBranch?.name}) *</label>
                          <select required value={item.reference_id} onChange={(e) => handleReferenceSelect(idx, e.target.value)} className={inputCls}>
                            <option value="">-- Choose Class Schedule --</option>
                            {classSchedules.map((cs) => {
                              const start = new Date(cs.start_time);
                              const booked = parseInt(cs.booked_count || 0, 10);
                              const max = parseInt(cs.max_capacity || 20, 10);
                              const remaining = Math.max(0, max - booked);
                              const isFull = remaining <= 0;
                              const classFee = parseFloat(cs.class_price !== undefined ? cs.class_price : 0);
                              return (
                                <option key={cs.id} value={cs.id} disabled={isFull}>
                                  {cs.class_name} • {start.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — [Fee: ₹{classFee.toFixed(2)}] [{isFull ? 'HOUSEFULL' : `🟢 ${remaining} Left`}]
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {item.item_type === 'addon' && (
                        <div>
                          <label className={labelCls}>Select Add-on Service *</label>
                          <select required value={item.reference_id} onChange={(e) => handleReferenceSelect(idx, e.target.value)} className={inputCls}>
                            <option value="">-- Choose Add-on --</option>
                            {addons.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} - ₹{a.price}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {item.item_type === 'product' && (
                        <div>
                          <label className={labelCls}>Select Product (Stock for {activeBranch?.name}) *</label>
                          <select required value={item.reference_id} onChange={(e) => handleReferenceSelect(idx, e.target.value)} className={inputCls}>
                            <option value="">-- Choose Product SKU --</option>
                            {products.map((pr) => {
                              const pId = String(pr.product_id ?? pr.id);
                              const stockQty = Number(pr.current_stock ?? 0);
                              return (
                                <option key={pId} value={pId}>
                                  {pr.name} ({pr.sku}) — {stockQty <= 0 ? '⚠️ No Stock (0)' : `In Stock: ${stockQty}`} | MRP ₹{pr.selling_price || 0}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {item.item_type === 'locker' && (
                        <div>
                          <label className={labelCls}>Select Locker ({activeBranch?.name}) *</label>
                          <select required value={item.reference_id} onChange={(e) => handleReferenceSelect(idx, e.target.value)} className={inputCls}>
                            <option value="">-- Choose Available Locker --</option>
                            {lockers.map((l) => (
                              <option key={l.id} value={l.id} disabled={l.status === 'occupied'}>
                                Locker #{l.locker_number} {l.status === 'occupied' ? '(Occupied)' : `— ₹${l.effective_monthly_rent || l.monthly_rent || 0}/mo`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {item.item_type === 'other' && (
                        <div>
                          <label className={labelCls}>Custom Charge Description *</label>
                          <input
                            type="text"
                            name="description"
                            required
                            placeholder="e.g. Day Pass / Registration Charge"
                            value={item.description}
                            onChange={(e) => handleItemFieldChange(idx, e)}
                            className={inputCls}
                          />
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-4 flex gap-3">
                      {(item.item_type === 'membership' || item.item_type === 'locker' || item.item_type === 'pt_session' || item.item_type === 'class_enrollment') && (
                        <div className="w-full">
                          <label className={labelCls}>Start Date</label>
                          <input type="date" name="start_date" value={item.start_date} onChange={(e) => handleItemFieldChange(idx, e)} className={inputCls} />
                        </div>
                      )}

                      <div className={item.item_type === 'product' ? 'w-full' : 'w-24 shrink-0'}>
                        <label className={labelCls}>
                          {item.item_type === 'locker' ? 'Months' : 'Quantity'}
                        </label>
                        <input
                          type="number"
                          name="quantity"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemFieldChange(idx, e)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 bg-zinc-900 p-3.5 rounded-xl border border-zinc-800/60 items-center">
                    <div>
                      <label className={labelCls}>
                        {item.item_type === 'product' ? 'Selling MRP (₹) *' : 'Unit Price (₹) *'}
                      </label>
                      <input
                        type="number"
                        name="unit_price"
                        required
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unit_price}
                        onChange={(e) => handleItemFieldChange(idx, e)}
                        className={`${inputCls} font-mono font-bold text-white`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Discount (₹)</label>
                      <input
                        type="number"
                        name="discount_amount"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.discount_amount}
                        onChange={(e) => handleItemFieldChange(idx, e)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>GST Tax Rate</label>
                      <select
                        name="tax_rate"
                        value={item.tax_rate}
                        onChange={(e) => handleItemFieldChange(idx, e)}
                        className={`${inputCls} font-mono`}
                      >
                        <option value="0">0% (Exempt / No Tax)</option>
                        <option value="5">5% GST</option>
                        <option value="12">12% GST</option>
                        <option value="18">18% GST (Standard)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Tax Output</label>
                      <div className="py-2 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-lime-400">
                        ₹{(calc.rows[idx]?.tax || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex flex-col justify-end text-right">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Line Total</span>
                      <span className="text-lime-400 font-bold text-xl font-mono leading-none">
                        ₹{(calc.rows[idx]?.total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-zinc-800">
            <div className="md:col-span-7 space-y-4">
              <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950/40 space-y-3">
                <label className={labelCls}>Promotional Offer / Voucher</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Coupon Code (e.g. FESTIVE20)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={Boolean(appliedCoupon)}
                    className={`${inputCls} uppercase font-mono font-bold tracking-wider`}
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-xl border border-red-500/30 transition shrink-0"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleVerifyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 text-xs font-bold rounded-xl border border-zinc-700 transition shrink-0 disabled:opacity-40"
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                  )}
                </div>
                {couponMessage.text && (
                  <p className={`text-xs font-medium ${couponMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {couponMessage.text}
                  </p>
                )}
              </div>

              <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950/40">
                <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-white mb-4">
                  <input
                    type="checkbox"
                    checked={includePayment}
                    onChange={(e) => setIncludePayment(e.target.checked)}
                    className="accent-lime-400 w-5 h-5 cursor-pointer"
                  />
                  Capture Counter Payment Now
                </label>
                {includePayment && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Paid Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={calc.grandTotal || undefined}
                        value={payment.amount}
                        onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                        className={`${inputCls} font-mono font-bold text-lime-400`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Payment Mode</label>
                      <select
                        value={payment.payment_method}
                        onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}
                        className={inputCls}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m.replace(/_/g, ' ').toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Txn Reference ID</label>
                      <input
                        type="text"
                        placeholder="UPI Ref / POS Slip"
                        value={payment.transaction_reference}
                        onChange={(e) => setPayment({ ...payment, transaction_reference: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Internal Remarks / Billing Notes</label>
                <textarea
                  name="notes"
                  rows="2"
                  value={formData.notes}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="Notes for accounting records..."
                ></textarea>
              </div>
            </div>

            {/* Financial Ledger Summary */}
            <div className="md:col-span-5">
              <div className="border border-zinc-800 rounded-2xl p-6 space-y-3.5 bg-zinc-950 sticky top-6 shadow-2xl">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2">
                  Financial Breakdown
                </h4>
                <div className="space-y-2 text-xs font-medium text-zinc-300">
                  <div className="flex justify-between">
                    <span>Taxable Base Value</span>
                    <span className="font-mono">₹{calc.subtotal.toFixed(2)}</span>
                  </div>
                  {calc.totalTax > 0 ? (
                    <>
                      <div className="flex justify-between text-zinc-400">
                        <span>CGST (Intra-state 50%)</span>
                        <span className="font-mono">₹{calc.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>SGST (Intra-state 50%)</span>
                        <span className="font-mono">₹{calc.sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lime-400 font-semibold">
                        <span>Total Output GST</span>
                        <span className="font-mono">₹{calc.totalTax.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-zinc-500">
                      <span>GST Taxes</span>
                      <span className="font-mono font-bold text-zinc-400">₹0.00 (Exempt)</span>
                    </div>
                  )}
                  {calc.totalDiscount > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Total Discounts & Offers</span>
                      <span className="font-mono">- ₹{calc.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {calc.roundOff !== 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Round Off</span>
                      <span className="font-mono">
                        {calc.roundOff >= 0 ? '+' : ''}₹{calc.roundOff.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800/80 pt-3 mt-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Net Amount Payable</span>
                    <span className="text-3xl font-bold text-lime-400 font-mono leading-none">
                      ₹{calc.grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic mt-2 text-right">
                    {numberToWordsINR(calc.grandTotal)}
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitLoading || !formData.member_id}
                    className="w-full py-3.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm uppercase tracking-wider rounded-xl transition disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)] flex justify-center items-center gap-2"
                  >
                    {submitLoading ? 'Finalizing Invoice...' : '💳 Process Checkout & Finalize'}
                  </button>
                  <p className="text-center text-[10px] text-zinc-500 mt-2.5 uppercase tracking-widest">
                    Auto-activates plans, books PT coaches, lockers & studio passes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}