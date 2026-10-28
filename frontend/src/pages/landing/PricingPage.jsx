import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { apiGet } from '../../api';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

// Plan(s) jisko "Most Popular" badge dikhana h (DB plan name se match hota h)
const POPULAR_PLAN_NAMES = ['Growth Club'];

// Purane/alag naam wali feature keys ko ek standard key par map karta h
const FEATURE_ALIASES = {
  biometric_attendance: ['biometric_attendance', 'iot_turnstile'],
  fitness_diet_engine: ['fitness_diet_engine', 'diet_workout_builder'],
  whatsapp_automation: ['whatsapp_automation', 'whatsapp_notifications'],
};

// Cards + comparison table dono me yehi list use hoti h
const FEATURE_LIST = [
  { key: 'billing', label: 'Billing & dues management' },
  { key: 'lockers', label: 'Locker management' },
  { key: 'expenses', label: 'Expense tracking' },
  { key: 'multi_branch', label: 'Multi-branch sync' },
  { key: 'pos', label: 'Supplements POS & inventory' },
  { key: 'pt_management', label: 'Personal training management' },
  { key: 'fitness_diet_engine', label: 'Workout & diet builder' },
  { key: 'classes', label: 'Class & batch booking' },
  { key: 'biometric_attendance', label: 'Biometric / turnstile access' },
  { key: 'payroll', label: 'Staff payroll runs' },
  { key: 'whatsapp_automation', label: 'WhatsApp automated alerts' },
  { key: 'custom_branding', label: 'Custom branding' },
];

const CARD_FEATURE_COUNT = 8; // card me top-8 features, baaki comparison table me

const FALLBACK_PLANS = [
  {
    name: 'Starter Solo',
    description: 'Solo gym owners ke liye core management & billing suite',
    monthly_price: 999,
    yearly_price: 9999,
    max_branches: 1,
    max_members: 250,
    max_users: 3,
    features: { billing: true, lockers: true, expenses: true },
  },
  {
    name: 'Growth Club',
    description: 'Growing clubs ke liye training sessions & 2 location support',
    monthly_price: 2499,
    yearly_price: 24999,
    max_branches: 2,
    max_members: 750,
    max_users: 8,
    features: { billing: true, multi_branch: true, lockers: true, expenses: true, pos: true, fitness_diet_engine: true, pt_management: true },
  },
  {
    name: 'Pro Fitness',
    description: 'Chain gyms ke liye classes, attendance automation aur payroll',
    monthly_price: 4999,
    yearly_price: 49999,
    max_branches: 5,
    max_members: 2500,
    max_users: 25,
    features: { billing: true, multi_branch: true, lockers: true, expenses: true, pos: true, fitness_diet_engine: true, pt_management: true, biometric_attendance: true, payroll: true, classes: true, whatsapp_automation: true },
  },
  {
    name: 'Enterprise Network',
    description: 'Franchise network ke liye unlimited locations aur full API power',
    monthly_price: 9999,
    yearly_price: 99999,
    max_branches: null,
    max_members: null,
    max_users: null,
    features: { billing: true, multi_branch: true, lockers: true, expenses: true, pos: true, fitness_diet_engine: true, pt_management: true, biometric_attendance: true, payroll: true, classes: true, whatsapp_automation: true, custom_branding: true },
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fontStack = {
  sans: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

function parseFeatures(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function hasFeature(features, key) {
  const keys = FEATURE_ALIASES[key] || [key];
  return keys.some((k) => features[k] === true);
}

function limitText(value, singular, plural) {
  if (value === null || value === undefined) return 'Unlimited';
  const n = Number(value);
  return `${n.toLocaleString('en-IN')} ${n === 1 ? singular : plural}`;
}

/* ------------------------------------------------------------------ */
/*  Interactive Spotlight Component                                    */
/* ------------------------------------------------------------------ */

function PlanCardWrapper({ children, isPopular, className = '' }) {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative group flex flex-col rounded-3xl border p-6 transition-all duration-300 overflow-hidden ${
        isPopular
          ? 'border-lime-400/80 bg-zinc-900/90 ring-1 ring-lime-400/30 shadow-[0_0_40px_rgba(163,230,53,0.18)] xl:-translate-y-2'
          : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
      } ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), ${
            isPopular ? 'rgba(163,230,53,0.2)' : 'rgba(163,230,53,0.1)'
          }, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PricingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Smooth Scrolling with Lenis
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  // Professional font load (Inter + JetBrains Mono)
  useEffect(() => {
    const id = 'pricing-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadPlans() {
      try {
        const res = await apiGet('/api/v1/saas/plans');
        if (!alive) return;
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setPlans(res.data);
        } else {
          setPlans(FALLBACK_PLANS);
        }
      } catch (e) {
        if (alive) setPlans(FALLBACK_PLANS);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadPlans();
    return () => {
      alive = false;
    };
  }, []);

  // DB plans ko price ke hisaab se sort karo (low -> high)
  const sortedPlans = useMemo(
    () =>
      [...plans]
        .filter((p) => p.is_active !== false)
        .sort((a, b) => Number(a.monthly_price) - Number(b.monthly_price)),
    [plans]
  );

  // Yearly saving % calculate
  const maxSavePct = useMemo(() => {
    const pcts = sortedPlans
      .filter((p) => Number(p.yearly_price) > 0 && Number(p.monthly_price) > 0)
      .map((p) => 1 - Number(p.yearly_price) / (Number(p.monthly_price) * 12));
    const best = pcts.length ? Math.max(...pcts) : 0;
    return Math.max(0, Math.round(best * 100));
  }, [sortedPlans]);

  const gridCols =
    sortedPlans.length >= 5
      ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
      : sortedPlans.length === 4
      ? 'md:grid-cols-2 xl:grid-cols-4'
      : 'md:grid-cols-2 lg:grid-cols-3';

  return (
    <div
      className="min-h-screen bg-black text-white antialiased selection:bg-lime-400 selection:text-black overflow-x-hidden"
      style={{ fontFamily: fontStack.sans }}
    >
      <LandingNavbar />

      {/* ---------------------------- Hero ---------------------------- */}
      <section className="relative pt-28 pb-16 px-6 text-center overflow-hidden">
        {/* Animated Radial Glow in Hero */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.08, 0.2, 0.08],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-lime-400 blur-[150px] rounded-full"
        />

        <div className="relative max-w-3xl mx-auto">
          <motion.span
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-400"
            style={{ fontFamily: fontStack.mono }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse" />
            Pricing Plans
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mt-6 text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1] text-white"
          >
            Simple pricing for every stage
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400">
              {' '}of your gym.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-5 text-base sm:text-lg leading-relaxed text-zinc-400 max-w-2xl mx-auto"
          >
            Koi hidden transaction charges nahi. Har plan par 14-day free trial.
            Kabhi bhi upgrade ya cancel karo.
          </motion.p>

          {/* Animated Billing Cycle Toggle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-9 inline-flex items-center rounded-2xl border border-zinc-800 bg-zinc-900/90 p-1.5 relative shadow-inner"
          >
            <div className="relative flex items-center">
              <button
                role="tab"
                aria-selected={billingCycle === 'monthly'}
                onClick={() => setBillingCycle('monthly')}
                className={`relative z-10 rounded-xl px-6 py-2.5 text-sm font-bold transition-colors ${
                  billingCycle === 'monthly' ? 'text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {billingCycle === 'monthly' && (
                  <motion.div
                    layoutId="activePill"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    className="absolute inset-0 bg-lime-400 rounded-xl -z-10 shadow-lg shadow-lime-400/25"
                  />
                )}
                Monthly
              </button>

              <button
                role="tab"
                aria-selected={billingCycle === 'yearly'}
                onClick={() => setBillingCycle('yearly')}
                className={`relative z-10 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-colors ${
                  billingCycle === 'yearly' ? 'text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {billingCycle === 'yearly' && (
                  <motion.div
                    layoutId="activePill"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    className="absolute inset-0 bg-lime-400 rounded-xl -z-10 shadow-lg shadow-lime-400/25"
                  />
                )}
                <span>Yearly</span>
                {maxSavePct > 0 && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-black transition-colors ${
                      billingCycle === 'yearly'
                        ? 'bg-black text-lime-400'
                        : 'bg-lime-400/15 text-lime-400 border border-lime-400/20'
                    }`}
                    style={{ fontFamily: fontStack.mono }}
                  >
                    SAVE {maxSavePct}%
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------- Cards --------------------------- */}
      <section className="max-w-[88rem] mx-auto px-6 pb-20">
        <div className={`grid grid-cols-1 ${gridCols} gap-6 items-stretch`}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : sortedPlans.map((p, idx) => (
                <motion.div
                  key={p.hash_id || p.name}
                  initial={{ opacity: 0, y: 35 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="h-full flex"
                >
                  <PlanCard
                    plan={p}
                    cycle={billingCycle}
                    isPopular={POPULAR_PLAN_NAMES.includes(p.name)}
                    onSelect={() =>
                      navigate(
                        `/checkout?plan=${encodeURIComponent(p.hash_id || p.name)}&cycle=${billingCycle}`
                      )
                    }
                  />
                </motion.div>
              ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center text-xs text-zinc-500 font-mono uppercase tracking-widest"
        >
          ⚡ Sabhi prices INR me hain. GST applicable hoga checkout par.
        </motion.p>
      </section>

      {/* ------------------------ Comparison table -------------------- */}
      {!loading && sortedPlans.length > 0 && (
        <section className="max-w-[88rem] mx-auto px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <span
              className="text-[10px] font-mono font-bold tracking-widest text-lime-400 uppercase"
              style={{ fontFamily: fontStack.mono }}
            >
              Full Breakdown
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-2">
              Compare all features
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Har plan me kya milta h, ek nazar me.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/40 shadow-2xl backdrop-blur-sm"
          >
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60">
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Features
                  </th>
                  {sortedPlans.map((p) => (
                    <th
                      key={p.hash_id || p.name}
                      className="px-5 py-5 text-center text-base font-extrabold text-white"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                <LimitRow
                  label="Gym locations"
                  plans={sortedPlans}
                  field="max_branches"
                  unit="Branch"
                  plural="Branches"
                />
                <LimitRow
                  label="Members"
                  plans={sortedPlans}
                  field="max_members"
                  unit="Member"
                  plural="Members"
                />
                <LimitRow
                  label="Staff accounts"
                  plans={sortedPlans}
                  field="max_users"
                  unit="Staff"
                  plural="Staff"
                />
                {FEATURE_LIST.map((f) => (
                  <tr
                    key={f.key}
                    className="hover:bg-zinc-800/40 transition-colors group"
                  >
                    <td className="px-6 py-4 text-zinc-300 font-medium group-hover:text-white transition-colors">
                      {f.label}
                    </td>
                    {sortedPlans.map((p) => {
                      const on = hasFeature(parseFeatures(p.features), f.key);
                      return (
                        <td
                          key={(p.hash_id || p.name) + f.key}
                          className="px-5 py-4 text-center"
                        >
                          {on ? <CheckIcon /> : <DashIcon />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </section>
      )}

      <LandingFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function PlanCard({ plan: p, cycle, isPopular, onSelect }) {
  const features = parseFeatures(p.features);
  const isYearly = cycle === 'yearly' && Number(p.yearly_price) > 0;
  const perMonth = isYearly ? Number(p.yearly_price) / 12 : Number(p.monthly_price);
  const visible = FEATURE_LIST.slice(0, CARD_FEATURE_COUNT);

  return (
    <PlanCardWrapper isPopular={isPopular} className="w-full">
      {isPopular && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-lime-400 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-lg shadow-lime-400/30"
          style={{ fontFamily: fontStack.mono }}
        >
          Most Popular
        </span>
      )}

      {/* Header */}
      <div>
        <h3 className="text-xl font-bold tracking-tight text-white">{p.name}</h3>
        <p className="mt-2 min-h-[40px] text-[13px] leading-relaxed text-zinc-400 line-clamp-2">
          {p.description}
        </p>
      </div>

      {/* Animated Price Counter & Switching */}
      <div className="mt-6">
        <div className="flex items-baseline gap-1.5">
          <AnimatePresence mode="wait">
            <motion.span
              key={perMonth}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="text-4xl font-black tracking-tight text-white tabular-nums"
            >
              {inr(perMonth)}
            </motion.span>
          </AnimatePresence>
          <span className="text-sm font-semibold text-zinc-500">/month</span>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500 tabular-nums font-mono">
          {isYearly ? `Billed ${inr(p.yearly_price)} per year` : 'Billed monthly'}
        </p>
      </div>

      {/* CTA Button with Micro-Interaction */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onSelect}
        className={`mt-6 w-full rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider transition-all duration-200 ${
          isPopular
            ? 'bg-lime-400 text-black hover:bg-lime-300 shadow-xl shadow-lime-400/25'
            : 'border border-zinc-700 bg-zinc-800/90 text-white hover:bg-zinc-700 hover:border-zinc-600'
        }`}
      >
        Start 14-Day Free Trial
      </motion.button>

      {/* Limits */}
      <dl className="mt-6 space-y-3.5 border-y border-zinc-800/80 py-5 text-[13px]">
        <LimitItem label="Gym locations" value={limitText(p.max_branches, 'Branch', 'Branches')} />
        <LimitItem label="Members" value={limitText(p.max_members, 'Member', 'Members')} />
        <LimitItem label="Staff accounts" value={limitText(p.max_users, 'Staff', 'Staff')} />
      </dl>

      {/* Features List */}
      <ul className="mt-5 space-y-3 text-[13px] flex-1">
        {visible.map((f) => (
          <FeatureItem key={f.key} label={f.label} active={hasFeature(features, f.key)} />
        ))}
      </ul>
    </PlanCardWrapper>
  );
}

function LimitItem({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-400 font-medium">{label}</dt>
      <dd className="font-bold text-white tabular-nums">{value}</dd>
    </div>
  );
}

function FeatureItem({ label, active }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{active ? <CheckIcon /> : <DashIcon />}</span>
      <span className={active ? 'text-zinc-200' : 'text-zinc-600'}>{label}</span>
    </li>
  );
}

function LimitRow({ label, plans, field, unit, plural }) {
  return (
    <tr className="bg-zinc-950/40">
      <td className="px-6 py-4 font-semibold text-zinc-200">{label}</td>
      {plans.map((p) => (
        <td
          key={(p.hash_id || p.name) + field}
          className="px-5 py-4 text-center font-bold text-lime-400 tabular-nums"
        >
          {limitText(p[field], unit, plural)}
        </td>
      ))}
    </tr>
  );
}

function CheckIcon() {
  return (
    <motion.svg
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      className="mx-auto h-4 w-4 text-lime-400"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Included"
    >
      <path d="M4 10.5l4 4 8-9" />
    </motion.svg>
  );
}

function DashIcon() {
  return (
    <svg
      className="mx-auto h-4 w-4 text-zinc-700"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-label="Not included"
    >
      <path d="M5 10h10" />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="h-6 w-32 rounded-lg bg-zinc-800" />
      <div className="mt-3 h-3.5 w-full rounded bg-zinc-800" />
      <div className="mt-2 h-3.5 w-2/3 rounded bg-zinc-800" />
      <div className="mt-8 h-10 w-40 rounded-lg bg-zinc-800" />
      <div className="mt-6 h-12 w-full rounded-2xl bg-zinc-800" />
      <div className="mt-8 space-y-3.5 border-y border-zinc-800/80 py-5">
        <div className="h-4 w-full rounded bg-zinc-800" />
        <div className="h-4 w-full rounded bg-zinc-800" />
        <div className="h-4 w-full rounded bg-zinc-800" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3.5 w-full rounded bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}