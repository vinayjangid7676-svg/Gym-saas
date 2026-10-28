import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api';

export default function LandingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // ROI Calculator states
  const [memberCount, setMemberCount] = useState(300);
  const [branchCount, setBranchCount] = useState(1);

  // 1. Fetch Plans from Backend Database
  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await apiGet('/api/v1/saas/plans');
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          // Exclude older demo tiers if present, focus on 4 standard tiers
          const cleanPlans = res.data.filter(p => !p.name.includes('Gym SaaS Pro Tier'));
          setPlans(cleanPlans.length > 0 ? cleanPlans : res.data);
        } else {
          // Instant Fallback to database schema matrix
          setPlans(FALLBACK_PLANS);
        }
      } catch (e) {
        setPlans(FALLBACK_PLANS);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  const calculateSavings = () => {
    // Estimated manual leakage & paperwork time savings in INR
    const estimatedLeakageLoss = memberCount * 70; // uncollected dues, manual lapses
    const staffHoursSaved = branchCount * 6000;
    return Math.round(estimatedLeakageLoss + staffHoursSaved);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-lime-400 selection:text-black font-sans antialiased">
      {/* ================================================================ */}
      {/* 1. TOP ANNOUNCEMENT & NAVIGATION BAR                             */}
      {/* ================================================================ */}
      <div className="bg-zinc-950 border-b border-zinc-900 py-2 px-4 text-center text-xs text-zinc-400">
        🚀 Next-Gen Multi-Branch Gym SaaS 2.0 is live. <span className="text-lime-400 font-semibold">14-Day Free Trial</span> included for all gyms.
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center shadow-lg shadow-lime-400/20">
              <span className="text-black font-black text-2xl tracking-tighter">G</span>
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white block leading-none">GymManager<span className="text-lime-400">OS</span></span>
              <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Enterprise SaaS</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#hardware" className="hover:text-white transition">Hardware & IoT</a>
            <a href="#calculator" className="hover:text-white transition">ROI Calculator</a>
            <a href="#pricing" className="text-lime-400 hover:text-lime-300 transition">Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-bold text-zinc-300 hover:text-white transition"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-5 py-2.5 rounded-xl bg-lime-400 text-black text-xs font-extrabold hover:bg-lime-300 transition shadow-lg shadow-lime-400/15"
            >
              Start Free Trial →
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 2. HERO SECTION                                                  */}
      {/* ================================================================ */}
      <section className="relative pt-24 pb-20 px-6 max-w-7xl mx-auto text-center overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-lime-400"></span>
          Engineered for Solo Clubs & National Franchise Networks
        </div>

        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.05]">
          Run Your Gym Empire On <span className="text-lime-400">Autopilot.</span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          From multi-branch fee collections and turnstile biometrics to auto-generated diet engines and locker grids — one unified platform for high-performance fitness hubs.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          // Hero button:
<button
  onClick={() => navigate('/checkout?plan=Starter%20Solo&cycle=monthly')}
  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-lime-400 text-black font-black text-sm hover:bg-lime-300 transition shadow-xl shadow-lime-400/20"
>
  Launch Your Gym OS (14-Day Free) ⚡
</button>
          <a
            href="#pricing"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm border border-zinc-800 transition"
          >
            Explore Pricing Tiers ↓
          </a>
        </div>

        {/* Dashboard Mockup Display */}
        <div className="mt-16 relative rounded-3xl border border-zinc-800 bg-zinc-950 p-2 sm:p-4 shadow-2xl">
          <div className="w-full rounded-2xl bg-zinc-900 border border-zinc-800/80 p-6 sm:p-8 text-left space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-mono text-zinc-500 ml-2">app.gymmanager.com/dashboard</span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-lime-400/10 text-lime-400 font-mono font-semibold">
                ● LIVE PRODUCTION NETWORK
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-black/60 p-4 rounded-xl border border-zinc-800">
                <p className="text-[11px] text-zinc-500 uppercase font-semibold">Active Members</p>
                <p className="text-2xl font-black text-white mt-1">1,248</p>
                <span className="text-[10px] text-emerald-400 font-bold">+18% this month</span>
              </div>
              <div className="bg-black/60 p-4 rounded-xl border border-zinc-800">
                <p className="text-[11px] text-zinc-500 uppercase font-semibold">Fee Collection</p>
                <p className="text-2xl font-black text-white mt-1">₹6,84,500</p>
                <span className="text-[10px] text-lime-400 font-bold">Auto-reconciled (UPI/QR)</span>
              </div>
              <div className="bg-black/60 p-4 rounded-xl border border-zinc-800">
                <p className="text-[11px] text-zinc-500 uppercase font-semibold">Biometric Check-ins</p>
                <p className="text-2xl font-black text-white mt-1">492</p>
                <span className="text-[10px] text-zinc-400">Peak hour: 6:00 PM - 8:30 PM</span>
              </div>
              <div className="bg-black/60 p-4 rounded-xl border border-zinc-800">
                <p className="text-[11px] text-zinc-500 uppercase font-semibold">Active Locations</p>
                <p className="text-2xl font-black text-white mt-1">3 Outlets</p>
                <span className="text-[10px] text-lime-400 font-bold">Multi-tenant synced</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 3. CORE ARCHITECTURE PILLARS                                     */}
      {/* ================================================================ */}
      <section id="features" className="py-24 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Enterprise Modules</h2>
            <p className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
              Every Tool Needed To Dominate The Fitness Market
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-2xl mb-6">
                🏢
              </div>
              <h3 className="text-xl font-bold text-white">Multi-Location Branch Sync</h3>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                Allow members cross-gym access or restrict to single locations. Centralized financials with isolated staff permissions per branch.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-2xl mb-6">
                ⏱️
              </div>
              <h3 className="text-xl font-bold text-white">IoT Biometrics & Dynamic QR</h3>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                Automated turnstiles, biometric scanners, and anti-screenshot dynamic QR access tokens that instantly deny entry to unpaid memberships.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-2xl mb-6">
                🥗
              </div>
              <h3 className="text-xl font-bold text-white">AI Workout & Macro Engine</h3>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                Build personalized workout splits (PPL, Arnold, Bro-split) and macro-calculated Indian diet charts directly for your athletes.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-2xl mb-6">
                🛒
              </div>
              <h3 className="text-xl font-bold text-white">Supplements POS & Inventory</h3>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                Fast barcode billing for whey protein, creatine, drinks, and apparel. Real-time batch expiry warnings and low-stock reorder alerts.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-2xl mb-6">
                💬
              </div>
              <h3 className="text-xl font-bold text-white">WhatsApp Automated Reminders</h3>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                Auto-send payment receipts, fee renewal links 3 days before expiry, birthday wishes, and inactive member recall alerts on WhatsApp.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-2xl mb-6">
                🛠️
              </div>
              <h3 className="text-xl font-bold text-white">Equipment Maintenance Logs</h3>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                Scan QR on treadmills/cables to log breakdowns, assign technicians, track downtime minutes, and calculate lifetime repair costs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 4. ROI CALCULATOR SECTION                                        */}
      {/* ================================================================ */}
      <section id="calculator" className="py-24 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 p-8 sm:p-12 rounded-3xl text-center">
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Interactive Savings Model</h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white mt-2">See How Much Revenue You Recover</h3>
            <p className="text-sm text-zinc-400 mt-2">Uncollected member dues and front-desk leakages cost the average gym ₹50,000+ monthly.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-10 text-left">
              <div>
                <label className="text-xs font-bold text-zinc-300 flex justify-between">
                  <span>Active Members:</span>
                  <span className="text-lime-400 font-mono text-sm">{memberCount}</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="25"
                  value={memberCount}
                  onChange={(e) => setMemberCount(parseInt(e.target.value, 10))}
                  className="w-full mt-3 accent-lime-400 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 flex justify-between">
                  <span>Number of Gym Outlets:</span>
                  <span className="text-lime-400 font-mono text-sm">{branchCount}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={branchCount}
                  onChange={(e) => setBranchCount(parseInt(e.target.value, 10))}
                  className="w-full mt-3 accent-lime-400 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-black/60 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <span className="text-xs font-semibold text-zinc-500 uppercase">Estimated Monthly Profit Recovered</span>
                <p className="text-3xl sm:text-4xl font-black text-lime-400 mt-0.5">₹{calculateSavings().toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-zinc-500">From zero fee leakage, automated WhatsApp collections & biometric gate locks.</p>
              </div>
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-3 rounded-xl bg-lime-400 text-black font-extrabold text-xs hover:bg-lime-300 transition whitespace-nowrap"
              >
                Recover Revenue Now →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 5. TOP-LEVEL PRICING MATRIX (DB TIERS 1:1)                       */}
      {/* ================================================================ */}
      <section id="pricing" className="py-24 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Predictable Pricing</h2>
            <p className="text-4xl sm:text-6xl font-black text-white tracking-tight mt-2">
              Transparent Plans. No Hidden Commissions.
            </p>
            <p className="text-sm text-zinc-400 mt-3">
              Upgrade, downgrade or cancel anytime. Every plan comes with full data ownership.
            </p>

            {/* Monthly / Yearly Switcher */}
            <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition ${
                  billingCycle === 'monthly' ? 'bg-lime-400 text-black shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  billingCycle === 'yearly' ? 'bg-lime-400 text-black shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Yearly Billing
                <span className="text-[10px] bg-black/80 text-lime-400 px-2 py-0.5 rounded-full font-mono font-extrabold">
                  SAVE 17%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {plans.map((p) => {
              const price = billingCycle === 'yearly' ? Math.round(Number(p.yearly_price) / 12) : Math.round(Number(p.monthly_price));
              const isPopular = p.name.includes('Growth') || p.name.includes('Pro');
              const featuresObj = typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || {});

              return (
                <div
                  key={p.hash_id || p.name}
                  className={`relative flex flex-col justify-between p-8 rounded-3xl border transition duration-300 ${
                    isPopular
                      ? 'bg-zinc-900 border-lime-400/60 ring-2 ring-lime-400/20 shadow-2xl shadow-lime-400/10'
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-lime-400 text-black text-[10px] font-black uppercase tracking-wider shadow">
                      Most Popular Tier
                    </span>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">{p.name}</h3>
                    <p className="text-xs text-zinc-400 mt-2 min-h-[36px] leading-relaxed">{p.description}</p>

                    <div className="my-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-white">₹{price.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-zinc-500 font-semibold">/ month</span>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono block mt-1">
                        {billingCycle === 'yearly' ? `Billed ₹${Number(p.yearly_price).toLocaleString('en-IN')} annually` : 'Billed monthly'}
                      </span>
                    </div>

                    {/* Hard Quotas */}
                    <div className="space-y-2 py-4 border-y border-zinc-800/80 text-xs text-zinc-300 font-medium">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Locations / Branches:</span>
                        <span className="font-bold text-white">{p.max_branches === null ? 'Unlimited' : `${p.max_branches} Branch`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Active Athletes:</span>
                        <span className="font-bold text-white">{p.max_members === null ? 'Unlimited' : `Up to ${p.max_members}`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Staff / Trainer Seats:</span>
                        <span className="font-bold text-white">{p.max_users === null ? 'Unlimited' : `${p.max_users} Accounts`}</span>
                      </div>
                    </div>

                    {/* Key Entitlements Checklist */}
                    <div className="mt-6 space-y-2.5 text-xs text-zinc-300">
                      <FeatureCheck label="Billing & Fee Management" enabled={featuresObj.billing} />
                      <FeatureCheck label="Cross-Branch Sync" enabled={featuresObj.multi_branch} />
                      <FeatureCheck label="Supplements POS & Inventory" enabled={featuresObj.pos} />
                      <FeatureCheck label="Diet & Workout Engine" enabled={featuresObj.fitness_diet_engine} />
                      <FeatureCheck label="Biometric Turnstile Access" enabled={featuresObj.biometric_attendance} />
                      <FeatureCheck label="Staff Payroll Engine" enabled={featuresObj.payroll} />
                      <FeatureCheck label="Batch & Class Booking" enabled={featuresObj.classes} />
                      <FeatureCheck label="WhatsApp Reminders API" enabled={featuresObj.whatsapp_automation} />
                    </div>
                  </div>

                  <div className="mt-8 pt-4">
                    // LandingPage.jsx ke andar pricing cards ke button me:
<button
  onClick={() => navigate(`/checkout?plan=${encodeURIComponent(p.hash_id || p.name)}&cycle=${billingCycle}`)}
  className={`w-full py-3.5 rounded-xl text-xs font-bold transition shadow-lg ${
    isPopular
      ? 'bg-lime-400 text-black hover:bg-lime-300 shadow-lime-400/20'
      : 'bg-zinc-800 text-white hover:bg-zinc-700'
  }`}
>
  Start 14-Day Free Trial →
</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature Matrix Table */}
          <div className="mt-20 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-10 overflow-hidden">
            <h3 className="text-xl font-bold text-white mb-6">Comprehensive Feature Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="p-4 font-bold uppercase text-[11px]">Feature Capability</th>
                    <th className="p-4 font-bold text-center">Starter Solo</th>
                    <th className="p-4 font-bold text-center">Growth Club</th>
                    <th className="p-4 font-bold text-center text-lime-400">Pro Fitness</th>
                    <th className="p-4 font-bold text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                  <tr>
                    <td className="p-4 font-semibold text-white">Physical Location Limit</td>
                    <td className="p-4 text-center">1 Branch</td>
                    <td className="p-4 text-center">2 Branches</td>
                    <td className="p-4 text-center font-bold text-lime-400">5 Branches</td>
                    <td className="p-4 text-center font-bold">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Active Member Limit</td>
                    <td className="p-4 text-center">250</td>
                    <td className="p-4 text-center">750</td>
                    <td className="p-4 text-center font-bold text-lime-400">2,500</td>
                    <td className="p-4 text-center font-bold">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Turnstile / Biometric Integration</td>
                    <td className="p-4 text-center text-zinc-600">✕</td>
                    <td className="p-4 text-center text-zinc-600">✕</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">POS Supplement Billing</td>
                    <td className="p-4 text-center text-zinc-600">✕</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Automated WhatsApp Reminders</td>
                    <td className="p-4 text-center text-zinc-600">✕</td>
                    <td className="p-4 text-center text-zinc-600">✕</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-white">Trainer Payroll & Commissions</td>
                    <td className="p-4 text-center text-zinc-600">✕</td>
                    <td className="p-4 text-center text-zinc-600">✕</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                    <td className="p-4 text-center text-lime-400 font-bold">✓ Included</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 6. HARDWARE & IOT SECTION                                        */}
      {/* ================================================================ */}
      <section id="hardware" className="py-24 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Hardware Ready</span>
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-2">
                Turnstiles, Face Scanners & Dynamic Anti-Passback QR.
              </h2>
              <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
                Connect your existing ZKTeco, Essl, or Hikvision turnstiles in minutes. Our cloud relay checks fee balance in &lt;150ms before triggering the relay lock.
              </p>
              <div className="mt-8 space-y-3 text-xs text-zinc-300">
                <div className="flex items-center gap-3">
                  <span className="text-lime-400 font-bold">✓</span>
                  <span>Zero-delay local network relay buffer during internet drops</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lime-400 font-bold">✓</span>
                  <span>Dynamic QR code regenerating every 15s to block barcode screenshots</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lime-400 font-bold">✓</span>
                  <span>Instant voice announcement on unpaid membership scan</span>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-black/60 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚪</span>
                  <div>
                    <p className="text-xs font-bold text-white">Main Turnstile Gate 01</p>
                    <p className="text-[10px] text-zinc-500 font-mono">IP: 192.168.1.120 · ZKTeco Pro</p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                  ONLINE (12ms)
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-black/60 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📱</span>
                  <div>
                    <p className="text-xs font-bold text-white">Dynamic QR Entry Scanner</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Fast optical scanner relay</p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 7. FOOTER                                                        */}
      {/* ================================================================ */}
      <footer className="border-t border-zinc-900 bg-black py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-lime-400 flex items-center justify-center text-black font-black">
              G
            </div>
            <span className="text-zinc-300 font-bold">GymManager OS SaaS Platform</span>
          </div>
          <p>© {new Date().getFullYear()} GymManager Inc. All rights reserved. Built for Indian Gym Franchises.</p>
          <div className="flex gap-4 text-zinc-400">
            <a href="/login" className="hover:text-white transition">Owner Portal</a>
            <a href="/admin/login" className="hover:text-red-400 transition">Root Master</a>
            <a href="#pricing" className="hover:text-white transition">Pricing Tiers</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Small UI helper for feature check item
function FeatureCheck({ label, enabled }) {
  return (
    <div className="flex items-center gap-2">
      {enabled ? (
        <span className="text-lime-400 font-bold shrink-0">✓</span>
      ) : (
        <span className="text-zinc-600 font-bold shrink-0">✕</span>
      )}
      <span className={enabled ? 'text-zinc-200' : 'text-zinc-600 line-through'}>{label}</span>
    </div>
  );
}

// Hardcoded fallback matching the exact Postgres schema
const FALLBACK_PLANS = [
  {
    name: 'Starter Solo',
    description: 'Solo gym owners ke liye core management & billing suite',
    monthly_price: 999,
    yearly_price: 9999,
    max_branches: 1,
    max_members: 250,
    max_users: 3,
    features: { billing: true, lockers: true, expenses: true, pos: false, fitness_diet_engine: false, biometric_attendance: false, payroll: false, classes: false, whatsapp_automation: false }
  },
  {
    name: 'Growth Club',
    description: 'Growing clubs ke liye training sessions & 2 location support',
    monthly_price: 2499,
    yearly_price: 24999,
    max_branches: 2,
    max_members: 750,
    max_users: 8,
    features: { billing: true, multi_branch: true, lockers: true, expenses: true, pos: true, fitness_diet_engine: true, pt_management: true, biometric_attendance: false, payroll: false, classes: false, whatsapp_automation: false }
  },
  {
    name: 'Pro Fitness',
    description: 'Chain gyms ke liye classes, attendance automation aur payroll',
    monthly_price: 4999,
    yearly_price: 49999,
    max_branches: 5,
    max_members: 2500,
    max_users: 25,
    features: { billing: true, multi_branch: true, lockers: true, expenses: true, pos: true, fitness_diet_engine: true, pt_management: true, biometric_attendance: true, payroll: true, classes: true, whatsapp_automation: true }
  },
  {
    name: 'Enterprise Network',
    description: 'Franchise network ke liye unlimited locations aur full API power',
    monthly_price: 9999,
    yearly_price: 99999,
    max_branches: null,
    max_members: null,
    max_users: null,
    features: { billing: true, multi_branch: true, lockers: true, expenses: true, pos: true, fitness_diet_engine: true, pt_management: true, biometric_attendance: true, payroll: true, classes: true, whatsapp_automation: true }
  }
];