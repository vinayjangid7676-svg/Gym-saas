import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiGet, apiPost, saveSession } from '../api';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
 
  const [orderSuccessData, setOrderSuccessData] = useState(null);

  const planParam = searchParams.get('plan') || 'Starter Solo';
  const cycleParam = searchParams.get('cycle') || 'monthly';

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState(cycleParam);
  const [plansList, setPlansList] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    gym_name: '',
    owner_name: '',
    phone: '',
    email: '',
    password: '',
    branch_name: '',
    city: 'Jaipur',
    state: 'Rajasthan',
    address: '',
    pincode: '',
    legal_name: '',
    tax_id_gst: ''
  });

  const [paymentOption, setPaymentOption] = useState('trial'); // 'trial' | 'pay_now'
  const [paymentMethod, setPaymentMethod] = useState('upi_qr'); // 'upi_qr' | 'card' | 'netbanking'
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch Plan Details from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await apiGet('/api/v1/saas/plans');
        if (res?.success && Array.isArray(res.data)) {
          setPlansList(res.data);
          const matched = res.data.find(
            p => p.hash_id === planParam || p.name.toLowerCase() === planParam.toLowerCase()
          );
          setSelectedPlan(matched || res.data[0]);
        }
      } catch (err) {
        console.error('Plan fetch error:', err);
      } finally {
        setLoadingPlans(false);
      }
    }
    fetchPlans();
  }, [planParam]);

  // Pricing & Tax Calculations
  const basePrice = selectedPlan
    ? (billingCycle === 'yearly'
        ? Number(selectedPlan.yearly_price || selectedPlan.monthly_price * 10)
        : Number(selectedPlan.monthly_price))
    : 0;

  const gstAmount = +(basePrice * 0.18).toFixed(2);
  const totalPayable = +(basePrice + gstAmount).toFixed(2);

// 2. Updated handleSubmitOrder
const handleSubmitOrder = async (e) => {
  e.preventDefault();
  setErrorMsg('');

  if (!formData.gym_name || !formData.owner_name || !formData.phone || !formData.password) {
    setErrorMsg('Gym Name, Owner Name, Mobile aur Password mandatory hain.');
    return;
  }

  setSubmitting(true);
  try {
    const payload = {
      ...formData,
      plan_id: selectedPlan?.hash_id || selectedPlan?.name,
      billing_cycle: billingCycle,
      payment_method: paymentOption === 'trial' ? 'trial' : paymentMethod
    };

    const res = await apiPost('/api/v1/auth/register-gym', payload);

    if (res?.success) {
      if (paymentOption === 'trial') {
        // Free trial: Instant login
        saveSession(res);
        window.location.href = '/dashboard';
      } else {
        // Paid / Verification mode: Show success waiting card
        setOrderSuccessData({
          gymName: formData.gym_name,
          planName: selectedPlan?.name,
          phone: formData.phone,
          total: totalPayable
        });
      }
    } else {
      setErrorMsg(res?.message || 'Onboarding processing me error aayi.');
    }
  } catch (err) {
    setErrorMsg('Network request fail ho gaya. Kripya dobara try karein.');
  } finally {
    setSubmitting(false);
  }
};

// 3. Render Success View (Agar application submit ho chuki ho)
if (orderSuccessData) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white selection:bg-lime-400 selection:text-black">
      <div className="max-w-lg w-full bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 bg-lime-400/10 text-lime-400 border border-lime-400/30 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-lime-400/10">
          ⚡
        </div>

        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Application Submitted Successfully!</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            Aapki subscription request for <strong>{orderSuccessData.gymName}</strong> ({orderSuccessData.planName}) platform verification queue me bhej di gayi hai.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-900 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Registered Phone:</span>
            <span className="font-mono text-zinc-200 font-bold">{orderSuccessData.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Plan Amount:</span>
            <span className="font-mono text-lime-400 font-bold">₹{orderSuccessData.total.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Current Status:</span>
            <span className="text-amber-400 font-bold">● SuperAdmin Verification Pending</span>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500">
          Super Admin team se verification complete hote hi aapko WhatsApp par activation link mil jayega, aur aap apne mobile aur password se seedhe login kar payenge.
        </p>

        <div className="flex gap-3 pt-2">
          <Link
            to="/"
            className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs border border-zinc-800 transition"
          >
            ← Back to Home
          </Link>
          <Link
            to="/login"
            className="flex-1 py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs transition"
          >
            Go to Login Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}

  if (loadingPlans) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 text-white">
        <div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 text-sm font-medium">Configuring Secure Checkout Deck...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-lime-400 selection:text-black">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lime-400 flex items-center justify-center text-black font-black text-lg">
              G
            </div>
            <span className="text-base font-black tracking-tight text-white">
              GymManager<span className="text-lime-400">OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>🔒 256-Bit SSL Encrypted Registration</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <span className="text-xs font-mono font-bold text-lime-400 tracking-wider uppercase">
            Step 2 of 2 · Subscription Setup
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
            Complete Your Gym Setup & Launch
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Apni gym ki details dalein aur turant 14-day free access shuru karein. No credit card lock required.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form Panel */}
          <div className="lg:col-span-7 space-y-6">
            {/* Section 1: Gym Information */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 sm:p-8 space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🏢</span> 1. Gym / Fitness Hub Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Gym Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Iron Forge Fitness"
                    value={formData.gym_name}
                    onChange={(e) => setFormData({ ...formData, gym_name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Primary Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Malviya Nagar Main Hub"
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">City</label>
                  <input
                    type="text"
                    placeholder="Jaipur"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">State</label>
                  <input
                    type="text"
                    placeholder="Rajasthan"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Pincode</label>
                  <input
                    type="text"
                    placeholder="302017"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Address Line</label>
                <input
                  type="text"
                  placeholder="Street / Plaza / Floor number"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">GST Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="08AAAAA0000A1Z5"
                    value={formData.tax_id_gst}
                    onChange={(e) => setFormData({ ...formData, tax_id_gst: e.target.value.toUpperCase() })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white uppercase outline-none focus:border-lime-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Business Registered Legal Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Iron Forge LLP"
                    value={formData.legal_name}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Owner Login Credentials */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 sm:p-8 space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>👤</span> 2. Owner Account & Security
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Singh"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Official Mobile (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="owner@gymbrand.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Master Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Activation Method */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 sm:p-8 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>💳</span> 3. Plan Activation Option
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  onClick={() => setPaymentOption('trial')}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                    paymentOption === 'trial'
                      ? 'bg-lime-400/10 border-lime-400 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="activation_type"
                    checked={paymentOption === 'trial'}
                    onChange={() => setPaymentOption('trial')}
                    className="mt-1 accent-lime-400"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">14-Day Free Trial (Zero Cost)</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Pay later after checking software at your gym.</p>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentOption('pay_now')}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                    paymentOption === 'pay_now'
                      ? 'bg-lime-400/10 border-lime-400 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="activation_type"
                    checked={paymentOption === 'pay_now'}
                    onChange={() => setPaymentOption('pay_now')}
                    className="mt-1 accent-lime-400"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">Instant Activation (Pay Now)</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">UPI, QR, Cards with official tax invoice.</p>
                  </div>
                </label>
              </div>

              {paymentOption === 'pay_now' && (
                <div className="pt-3 border-t border-zinc-900 space-y-3">
                  <p className="text-xs font-semibold text-zinc-400">Select Instant Gateway:</p>
                  <div className="flex gap-3 text-xs">
                    {['upi_qr', 'card', 'netbanking'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`px-4 py-2 rounded-xl border uppercase font-mono text-[11px] font-bold ${
                          paymentMethod === m ? 'bg-zinc-800 text-lime-400 border-lime-400/40' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        {m === 'upi_qr' ? '⚡ UPI / QR' : m === 'card' ? '💳 Credit/Debit' : '🏦 NetBanking'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Summary Panel */}
          <div className="lg:col-span-5 sticky top-28 space-y-6">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Subscription Summary</h3>
                <span className="text-[11px] font-mono text-lime-400 bg-lime-400/10 px-2.5 py-0.5 rounded-full border border-lime-400/20">
                  {billingCycle === 'yearly' ? 'ANNUAL 17% OFF' : 'MONTHLY'}
                </span>
              </div>

              {/* Plan Switcher Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Selected Plan Tier:</label>
                <select
                  value={selectedPlan?.hash_id || selectedPlan?.name || ''}
                  onChange={(e) => {
                    const found = plansList.find(p => p.hash_id === e.target.value || p.name === e.target.value);
                    if (found) setSelectedPlan(found);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-lime-400 font-bold"
                >
                  {plansList.map((p) => (
                    <option key={p.hash_id || p.name} value={p.hash_id || p.name}>
                      {p.name} — ₹{billingCycle === 'yearly' ? Math.round(Number(p.yearly_price) / 12) : Number(p.monthly_price)}/mo
                    </option>
                  ))}
                </select>
              </div>

              {/* Cycle Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl text-xs font-bold text-center">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`py-2 rounded-lg transition ${billingCycle === 'monthly' ? 'bg-lime-400 text-black' : 'text-zinc-400'}`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`py-2 rounded-lg transition ${billingCycle === 'yearly' ? 'bg-lime-400 text-black' : 'text-zinc-400'}`}
                >
                  Yearly (-17%)
                </button>
              </div>

              {/* Quotas overview */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-900 space-y-2 text-xs text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Gym Locations:</span>
                  <span className="font-bold text-white">{selectedPlan?.max_branches === null ? 'Unlimited' : `${selectedPlan?.max_branches} Branch`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Active Member Limit:</span>
                  <span className="font-bold text-white">{selectedPlan?.max_members === null ? 'Unlimited' : `${selectedPlan?.max_members} Athletes`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Staff Accounts:</span>
                  <span className="font-bold text-white">{selectedPlan?.max_users === null ? 'Unlimited' : `${selectedPlan?.max_users} Staff`}</span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-xs border-t border-zinc-900 pt-4">
                <div className="flex justify-between text-zinc-400">
                  <span>Base Subscription:</span>
                  <span className="font-mono text-white">₹{basePrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>GST (18% Input Tax Credit):</span>
                  <span className="font-mono text-white">₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-zinc-900">
                  <span>{paymentOption === 'trial' ? 'Due Today (Trial):' : 'Total Payable:'}</span>
                  <span className="font-mono text-lime-400 text-lg">
                    {paymentOption === 'trial' ? '₹0.00' : `₹${totalPayable.toLocaleString('en-IN')}`}
                  </span>
                </div>
                {paymentOption === 'trial' && (
                  <p className="text-[11px] text-zinc-500 pt-1 text-center">
                    ₹{totalPayable.toLocaleString('en-IN')} will be billed after 14 days on approval.
                  </p>
                )}
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-lime-400 hover:bg-lime-300 text-black font-black text-sm tracking-wide transition shadow-xl shadow-lime-400/20 disabled:opacity-50"
              >
                {submitting
                  ? 'Configuring Workspace...'
                  : paymentOption === 'trial'
                  ? 'Launch 14-Day Free Workspace ⚡'
                  : 'Authorize & Pay ₹' + totalPayable.toLocaleString('en-IN') + ' →'}
              </button>

              <div className="text-center text-[11px] text-zinc-500 space-y-1">
                <p>✓ Instant access to all plan modules</p>
                <p>✓ Automated invoice sent to registered email</p>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}