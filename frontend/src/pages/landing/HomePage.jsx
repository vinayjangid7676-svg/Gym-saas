import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

const STATS = [
  { value: 500, suffix: '+', label: 'Fitness Clubs Onboard' },
  { value: 2.4, suffix: 'M+', label: 'Check-ins Processed', decimals: 1 },
  { value: 98.7, suffix: '%', label: 'Fee Recovery Rate', decimals: 1 },
  { value: 150, suffix: 'ms', label: 'Gate Response Time' },
];

const OUTCOMES = [
  {
    icon: '💸',
    title: 'Dues Recovery on Autopilot',
    result: 'Owners report up to 98% fee collection',
    desc: 'Reminders, renewals and payment links reach members automatically — before the due date, not after.',
  },
  {
    icon: '🏢',
    title: 'Every Branch. One Screen.',
    result: 'Consolidated view of your entire chain',
    desc: 'Revenue, attendance and staff activity across all outlets — live, in a single dashboard.',
  },
  {
    icon: '🔐',
    title: 'Controlled Entry, Zero Arguments',
    result: 'Gate decisions in milliseconds',
    desc: 'Members with active memberships walk in. Expired ones get a polite denial — and a renewal link.',
  },
  {
    icon: '🧾',
    title: 'Tax-Ready Books, Always',
    result: 'Clean records your CA will love',
    desc: 'Every transaction lands in a compliant invoice. Month-end becomes a 10-minute task.',
  },
  {
    icon: '👥',
    title: 'A Team That Runs Itself',
    result: 'Attendance to payout, fully tracked',
    desc: 'Shifts, leaves, and monthly payouts happen on schedule — without spreadsheets.',
  },
  {
    icon: '📈',
    title: 'Decisions From Live Data',
    result: 'Know what is working, today',
    desc: 'Which plan sells, which batch fills, which branch lags — answers, not guesses.',
  },
];

const CAPABILITIES = [
  'Member Operations', 'Smart Access', 'Billing & Payments', 'Personal Training',
  'Classes & Batches', 'Nutrition Plans', 'Retail POS', 'Asset Care',
  'Staff & Payroll', 'Lead Pipeline', 'Member Engagement', 'Chain Analytics',
];

const WORKFLOW = [
  { step: '01', title: 'Member Arrives', desc: 'Entry is validated instantly — no register, no argument, no front-desk bottleneck.' },
  { step: '02', title: 'System Responds', desc: 'Active members walk through. Due memberships trigger a friendly renewal nudge automatically.' },
  { step: '03', title: 'Revenue Lands', desc: 'Payments reconcile themselves. Receipts reach members instantly. Books stay clean.' },
];

const TESTIMONIALS = [
  {
    name: 'Rohit Malhotra',
    role: 'Owner, IronCore Fitness — Delhi (4 Branches)',
    quote: 'Uncollected dues dropped from ₹1.8L/month to nearly zero. The reminder automation alone paid for the platform 10x over.',
    img: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=200&auto=format&fit=crop',
  },
  {
    name: 'Sneha Kulkarni',
    role: 'Manager, FlexZone CrossFit — Pune',
    quote: 'Entry management became plug-and-play. Front desk chaos is gone — decisions happen in milliseconds.',
    img: 'https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?q=80&w=200&auto=format&fit=crop',
  },
  {
    name: 'Arjun Nair',
    role: 'Director, Pulse Arena — Bengaluru',
    quote: 'Machines, payroll, sales, member plans — everything in one stack. I check one dashboard and I know my business.',
    img: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=200&auto=format&fit=crop',
  },
];

const FAQS = [
  { q: 'Is GYMORA suitable for a single gym or a chain?', a: 'Both. Plans scale from a single outlet to unlimited-branch chains, with consolidated reporting at every level.' },
  { q: 'Will it work with my existing hardware?', a: 'In most cases, yes. Our onboarding team evaluates your current setup and connects supported devices at no extra cost.' },
  { q: 'Do I need an accountant to handle billing?', a: 'No. Invoices, tax splits and monthly summaries are generated automatically. Your CA gets clean, export-ready reports.' },
  { q: 'What happens after the 14-day trial?', a: 'Your data stays safe. Continue with a plan — or export everything and leave. No lock-in, no hidden charges.' },
];

function AnimatedCounter({ target, suffix, decimals = 0 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        const start = performance.now();
        const dur = 1600;
        const tick = (t) => {
          const p = Math.min((t - start) / dur, 1);
          setVal(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      },
      { threshold: 0.4 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function SpotlightCard({ children, className = '' }) {
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.current = e.clientX - rect.left;
    mouseY.current = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${mouseX.current}px`);
    cardRef.current.style.setProperty('--mouse-y', `${mouseY.current}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative group rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 transition-all duration-300 hover:border-lime-400/50 hover:shadow-[0_0_35px_rgba(163,230,53,0.12)] overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(163,230,53,0.15), transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}

/* =========================================================================
   LIVE EDGE ACCESS CONTROL SIMULATOR
   ========================================================================= */
function LiveAccessSimulator() {
  const [selectedScenario, setSelectedScenario] = useState('active');
  const [isScanning, setIsScanning] = useState(false);

  const triggerScan = (scenario) => {
    setSelectedScenario(scenario);
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 600);
  };

  return (
    <section className="py-24 border-t border-zinc-900 bg-gradient-to-b from-black via-zinc-950 to-black relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-lime-400/5 blur-[160px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">
            Live Gate Technology
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight mt-3">
            See How The Gate Reacts in <span className="text-lime-400">42ms</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-3">
            Click below to test live membership validation and automated revenue recovery triggers.
          </p>

          <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl">
            <button
              onClick={() => triggerScan('active')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedScenario === 'active'
                  ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Test Case 1: Active Member
            </button>
            <button
              onClick={() => triggerScan('expired')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedScenario === 'expired'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Test Case 2: Due / Expired Member
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <AnimatePresence>
            {isScanning && (
              <motion.div
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className={`absolute inset-x-0 h-1 shadow-lg pointer-events-none z-30 ${
                  selectedScenario === 'active'
                    ? 'bg-lime-400 shadow-[0_0_20px_#a3e635]'
                    : 'bg-red-500 shadow-[0_0_20px_#ef4444]'
                }`}
              />
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="relative w-56 h-56 rounded-3xl border border-zinc-700 bg-black/80 flex items-center justify-center overflow-hidden shadow-inner">
                <div className="absolute inset-4 border border-dashed border-zinc-800 rounded-2xl pointer-events-none" />
                <div className="absolute top-2 left-2 text-[9px] font-mono text-zinc-500">EDGE_CAM_01</div>
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[9px] font-mono text-emerald-400">ONLINE</span>
                </div>

                <img
                  src={
                    selectedScenario === 'active'
                      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop'
                      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop'
                  }
                  alt="Member Scan"
                  className="w-36 h-36 rounded-2xl object-cover border border-zinc-700"
                />

                <motion.div
                  key={selectedScenario}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute bottom-3 inset-x-4 py-1.5 px-3 rounded-xl text-center text-xs font-mono font-bold uppercase tracking-wider backdrop-blur-md ${
                    selectedScenario === 'active'
                      ? 'bg-lime-400/20 text-lime-400 border border-lime-400/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}
                >
                  {selectedScenario === 'active' ? '✓ VERIFIED: VIP GOLD' : '✕ HOLD: DUES PENDING'}
                </motion.div>
              </div>

              <div className="mt-4 flex items-center gap-3 text-xs font-mono text-zinc-500">
                <span>Latency: <strong className="text-zinc-300">38ms</strong></span>
                <span>•</span>
                <span>Relay: <strong className="text-zinc-300">Wiegand 26</strong></span>
              </div>
            </div>

            <div className="md:col-span-7 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Automated Decision Engine</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">PostgreSQL Cloud</span>
              </div>

              {selectedScenario === 'active' ? (
                <motion.div
                  key="active-log"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3"
                >
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-mono">Turnstile Flap Barrier</p>
                      <p className="text-base font-bold text-lime-400 mt-0.5">GATE UNLOCKED (Relay Triggered)</p>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-lime-400/20 text-lime-400 flex items-center justify-center font-bold">✓</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-mono">Attendance Ledger</p>
                      <p className="text-sm font-semibold text-zinc-200 mt-0.5">Check-in timestamp persisted to cloud</p>
                    </div>
                    <span className="text-xs font-mono text-zinc-500">Just now</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="expired-log"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3"
                >
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-red-500/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-mono">Turnstile Flap Barrier</p>
                      <p className="text-base font-bold text-red-400 mt-0.5">RELAY LOCKED (Polite Red LED Prompt)</p>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold">✕</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-lime-400/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-mono">WhatsApp Autopilot</p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        Sent Razorpay 1-Click Renewal Link to <strong className="text-lime-400">+91 98***</strong>
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-lime-400/10 text-lime-400 border border-lime-400/30">
                      SENT ⚡
                    </span>
                  </div>
                </motion.div>
              )}

              <p className="text-[11px] text-zinc-500 italic pt-1">
                * Front-desk staff arguments zero. Payments recover automatically before the next workout starts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [memberCount, setMemberCount] = useState(350);
  const [branchCount, setBranchCount] = useState(1);
  const [activeFaq, setActiveFaq] = useState(0);

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

  const calculateSavings = () => {
    const uncollectedLoss = memberCount * 75;
    const staffHours = branchCount * 6500;
    return Math.round(uncollectedLoss + staffHours);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-lime-400 selection:text-black font-sans antialiased overflow-x-hidden">
      <LandingNavbar />

      {/* ================= HERO ================= */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.12, 0.22, 0.12],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[500px] bg-lime-400 blur-[150px] rounded-full pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto text-center">
          
          {/* REPLACED: Real Live Production Telemetry Badge */}
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => navigate('/hardware')}
            className="group cursor-pointer inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-lime-400/50 text-[11px] font-mono transition duration-300 mb-8 shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping inline-block" />
              <span className="text-lime-400 font-bold uppercase tracking-wider">500+ CLUBS LIVE</span>
            </div>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300 font-semibold">99.98% Gateway Uptime</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 flex items-center gap-1 group-hover:text-lime-400 transition-colors">
              Hardware Specs <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]"
          >
            Run Your Gym Empire
            <br />
            On{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400">
              Autopilot.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            One platform for fee collection, member access, billing, staff, and
            every branch — so you focus on growth, not paperwork.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(163,230,53,0.4)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/checkout?plan=Starter%20Solo&cycle=monthly')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-lime-400 text-black font-black text-sm transition"
            >
              Launch 14-Day Free Trial ⚡
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/features')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm border border-zinc-800 transition"
            >
              See What It Does →
            </motion.button>
          </motion.div>

          {/* Trust Chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-mono text-zinc-500 uppercase tracking-widest"
          >
            <span>⚡ Instant Payment Reconciliation</span>
            <span>🛡️ Enterprise-Grade Security</span>
            <span>💬 Built-in Member Engagement</span>
            <span>🇮🇳 Made for Indian Gyms</span>
          </motion.div>

          {/* Hero Visual Card */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="mt-16 relative rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl group"
          >
            <img
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1600&auto=format&fit=crop"
              alt="Modern gym floor managed by GYMORA"
              className="w-full h-80 sm:h-[480px] object-cover brightness-[0.45] group-hover:scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-8 sm:p-12 text-left">
              <span className="text-xs font-mono font-bold text-lime-400 uppercase tracking-widest">
                Live Cloud Console
              </span>
              <h3 className="text-2xl sm:text-4xl font-black mt-1 max-w-2xl">
                Turn Uncollected Dues Into Automated Revenue.
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mt-2 max-w-lg">
                Payments reconcile themselves, renewals go out on time, and
                access stays under control — across every branch.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= INTERACTIVE GATE SIMULATOR ================= */}
      <LiveAccessSimulator />

      {/* ================= STATS COUNTER ================= */}
      <section className="border-y border-zinc-900 bg-zinc-950/60">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
          {STATS.map((s, idx) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15, duration: 0.5 }}
            >
              <p className="text-4xl sm:text-5xl font-black text-lime-400">
                <AnimatedCounter target={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
              </p>
              <p className="text-xs text-zinc-500 mt-2 uppercase tracking-widest font-mono">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ================= OUTCOMES ================= */}
      <section className="py-24 bg-zinc-950/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">
              Why Owners Switch
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mt-3">
              Results You Can Measure.
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base mt-4">
              We do not sell features. We sell mornings without follow-up calls,
              months without dues, and books that close themselves.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {OUTCOMES.map((o, idx) => (
              <motion.div
                key={o.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <SpotlightCard>
                  <span className="text-3xl">{o.icon}</span>
                  <h3 className="text-lg font-bold mt-5 text-white">{o.title}</h3>
                  <p className="text-sm font-bold text-lime-400 mt-1.5">{o.result}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed mt-3">{o.desc}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CAPABILITIES (INFINITE MARQUEE) ================= */}
      <section className="py-16 border-t border-zinc-900 overflow-hidden">
        <div className="text-center mb-6">
          <p className="text-[11px] font-mono font-bold text-zinc-600 uppercase tracking-widest">
            One Platform Covers Everything
          </p>
        </div>
        <div className="flex w-full overflow-hidden mask-fade-edges">
          <motion.div
            className="flex gap-4 flex-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ ease: 'linear', duration: 25, repeat: Infinity }}
          >
            {[...CAPABILITIES, ...CAPABILITIES].map((c, i) => (
              <span
                key={i}
                className="px-6 py-3 whitespace-nowrap rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:border-lime-400/50 hover:text-lime-400 transition cursor-default"
              >
                {c}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================= WORKFLOW STEPS ================= */}
      <section className="py-24 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">The Autopilot Loop</span>
            <h2 className="text-3xl sm:text-5xl font-black mt-3">How It Works While You Sleep</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WORKFLOW.map((w, idx) => (
              <motion.div
                key={w.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="relative p-8 rounded-3xl bg-zinc-900/40 border border-zinc-800 hover:border-lime-400/40 transition-all duration-300 hover:-translate-y-1.5"
              >
                <span className="text-5xl font-black text-lime-400/15 absolute top-5 right-7">{w.step}</span>
                <h3 className="text-lg font-bold mt-4">{w.title}</h3>
                <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ROI CALCULATOR ================= */}
      <section className="py-24 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 p-8 sm:p-12 rounded-3xl text-center shadow-2xl"
          >
            <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Revenue Recovery</span>
            <h3 className="text-3xl sm:text-4xl font-black mt-3">Calculate Your Monthly Leakage</h3>
            <p className="text-sm text-zinc-400 mt-3">
              See how much revenue automation recovers by eliminating manual collection gaps.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-10 text-left">
              <div>
                <label className="text-xs font-bold text-zinc-300 flex justify-between">
                  <span>Active Members</span>
                  <span className="text-lime-400 font-mono text-sm">{memberCount}</span>
                </label>
                <input
                  type="range" min="50" max="2000" step="25" value={memberCount}
                  onChange={(e) => setMemberCount(parseInt(e.target.value, 10))}
                  className="w-full mt-3 accent-lime-400 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-300 flex justify-between">
                  <span>Gym Outlets / Branches</span>
                  <span className="text-lime-400 font-mono text-sm">{branchCount}</span>
                </label>
                <input
                  type="range" min="1" max="10" value={branchCount}
                  onChange={(e) => setBranchCount(parseInt(e.target.value, 10))}
                  className="w-full mt-3 accent-lime-400 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-black/60 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <span className="text-xs font-semibold text-zinc-500 uppercase">Estimated Monthly Profit Recovered</span>
                <p className="text-3xl sm:text-4xl font-black text-lime-400 mt-1 tabular-nums">
                  ₹{calculateSavings().toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  From automated reminders and controlled access alone.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/pricing')}
                className="px-6 py-3 rounded-xl bg-lime-400 text-black font-extrabold text-xs hover:bg-lime-300 transition whitespace-nowrap shadow-lg shadow-lime-400/20"
              >
                Choose Plan & Launch →
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Owners Love GYMORA</span>
            <h2 className="text-3xl sm:text-5xl font-black mt-3">Real Gyms. Real Recovery.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <motion.figure
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="p-7 rounded-3xl bg-zinc-900/50 border border-zinc-800 flex flex-col hover:border-zinc-700 transition"
              >
                <blockquote className="text-sm text-zinc-300 leading-relaxed flex-1">"{t.quote}"</blockquote>
                <figcaption className="flex items-center gap-3 mt-6">
                  <img src={t.img} alt={t.name} className="w-11 h-11 rounded-full object-cover border border-zinc-700" loading="lazy" />
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-[11px] text-zinc-500">{t.role}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FAQ ACCORDION WITH ANIMATEPRESENCE ================= */}
      <section className="py-24 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3">Questions, Answered.</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={f.q} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? -1 : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-bold hover:bg-zinc-900 transition"
                >
                  {f.q}
                  <motion.span
                    animate={{ rotate: activeFaq === i ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-lime-400 text-lg"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence>
                  {activeFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-24 border-t border-zinc-900 relative">
        <div className="absolute inset-0 bg-lime-400/5 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight">
            Your Gym Deserves <span className="text-lime-400">GYMORA.</span>
          </h2>
          <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
            Join 500+ fitness businesses running on autopilot. Setup in under 30 minutes — data migration included.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/checkout?plan=Starter%20Solo&cycle=monthly')}
              className="px-10 py-4 rounded-2xl bg-lime-400 text-black font-black text-sm transition shadow-xl shadow-lime-400/25"
            >
              Start Free Trial — No Card Required
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/pricing')}
              className="px-10 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-lime-400/50 text-sm font-bold transition"
            >
              View Pricing
            </motion.button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}