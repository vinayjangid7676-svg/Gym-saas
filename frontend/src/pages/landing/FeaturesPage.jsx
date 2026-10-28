import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

/* ================================================================
   GYMORA SaaS - Features Page (FeaturesPage.jsx)
   Strategy: Visual product tour. Benefits & outcomes only.
   NO data models, NO tech specs, NO internal logic on public site.
   The real depth lives INSIDE the product (post-login).
   ================================================================ */

const CATEGORIES = [
  { id: 'all', label: 'Everything' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'operations', label: 'Operations' },
  { id: 'experience', label: 'Member Experience' },
  { id: 'people', label: 'Team & People' },
  { id: 'scale', label: 'Multi-Branch' },
];

/* Benefits phrased as OUTCOMES — nothing here reveals implementation */
const TOUR = [
  {
    id: 'member-ops',
    category: 'operations',
    badge: 'MEMBER OPERATIONS',
    title: 'Every Member, One Complete Profile',
    outcome: 'Front desk answers in seconds — documents, history, contacts, everything in one view.',
    img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Complete member records with documents and verification status',
      'Health notes, measurements and goals — tracked over time',
      'Segments and tags for targeted communication',
      'Referral connections visible at a glance',
    ],
    highlight: '3-second member lookup at the desk',
  },
  {
    id: 'smart-access',
    category: 'operations',
    badge: 'SMART ACCESS',
    title: 'Entry That Polices Itself',
    outcome: 'Valid members walk in instantly. Expired memberships get a friendly renewal nudge — automatically.',
    img: 'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Works with modern biometric and QR entry devices',
      'Entry decisions in milliseconds, around the clock',
      'Automatic renewal prompts when access lapses',
      'Full entry history for every member',
    ],
    highlight: 'Works unmanned — 24/7 controlled entry',
  },
  {
    id: 'billing',
    category: 'revenue',
    badge: 'BILLING & PAYMENTS',
    title: 'Money In, Books Clean',
    outcome: 'Every payment — cash, UPI, or card — lands in a proper invoice and reconciles itself.',
    img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Tax-compliant invoices generated automatically',
      'Accepts all popular payment methods',
      'Partial payments and dues tracked live',
      'Month-end summaries ready for your CA',
    ],
    highlight: 'Zero manual reconciliation',
  },
  {
    id: 'coaching',
    category: 'experience',
    badge: 'PERSONAL TRAINING',
    title: 'Training as a Profitable Business Line',
    outcome: 'Sell packages, track sessions, and pay trainers accurately — without a single spreadsheet.',
    img: 'https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Session packages with simple punch tracking',
      'Trainer earnings calculated automatically',
      'Workout and progress tracking per client',
      'Retention visibility across your training clients',
    ],
    highlight: 'Trainers focus on clients, not paperwork',
  },
  {
    id: 'classes',
    category: 'experience',
    badge: 'CLASSES & BATCHES',
    title: 'Batches That Fill Themselves',
    outcome: 'Members book their own slots. Cancellations backfill automatically. No-show patterns surface on their own.',
    img: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Online booking with automatic capacity control',
      'Waitlisted members promoted when slots open',
      'Attendance and no-show trends per batch',
      'Batch performance at a glance',
    ],
    highlight: 'Full classes, fewer empty slots',
  },
  {
    id: 'nutrition',
    category: 'experience',
    badge: 'NUTRITION',
    title: 'Diet Plans Members Actually Follow',
    outcome: 'Goal-based meal plans with familiar foods — assigned in minutes, adherence visible daily.',
    img: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Ready plans for cutting, bulking, or maintenance',
      'Food library built around Indian meals',
      'Members log adherence from their phone',
      'Trainers see compliance without chasing',
    ],
    highlight: 'Nutrition coaching, productized',
  },
  {
    id: 'retail',
    category: 'revenue',
    badge: 'RETAIL & INVENTORY',
    title: 'Counter Sales Without the Chaos',
    outcome: 'Scan, bill, done — with stock levels and expiry under control automatically.',
    img: 'https://images.unsplash.com/photo-1546483875-ad9014c88eba?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Fast barcode-based billing at reception',
      'Stock movements recorded automatically',
      'Low-stock warnings before you run out',
      'Tax-ready product invoicing',
    ],
    highlight: 'Retail that never misses a sale',
  },
  {
    id: 'assets',
    category: 'operations',
    badge: 'ASSET CARE',
    title: 'Machines That Never Surprise You',
    outcome: 'Every asset has a digital file — maintenance on schedule, breakdowns resolved fast, warranties never missed.',
    img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Complete asset register with purchase and warranty info',
      'Preventive care scheduled automatically',
      'Breakdown tickets with resolution tracking',
      'Downtime and repair costs visible per machine',
    ],
    highlight: 'No more surprise repair bills',
  },
  {
    id: 'team',
    category: 'people',
    badge: 'TEAM & PAYROLL',
    title: 'A Payroll That Runs Itself',
    outcome: 'Attendance to payout in one flow — late marks, extra hours, and commissions handled by the system.',
    img: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Daily attendance captured at check-in',
      'Extra hours and adjustments calculated fairly',
      'Monthly payout runs in one click',
      'Clear roles — everyone sees only what they need',
    ],
    highlight: 'Salary day, minus the stress',
  },
  {
    id: 'pipeline',
    category: 'revenue',
    badge: 'LEAD PIPELINE',
    title: 'Enquiries That Never Go Cold',
    outcome: 'Every walk-in and message enters a pipeline with owners, reminders, and a visible conversion funnel.',
    img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'All enquiries captured in one place',
      'Follow-ups assigned with automatic reminders',
      'Funnel view from enquiry to joining',
      'Channel performance — spend where it converts',
    ],
    highlight: 'Higher conversion, zero leakage',
  },
  {
    id: 'engagement',
    category: 'experience',
    badge: 'MEMBER ENGAGEMENT',
    title: 'Communication Members Actually Read',
    outcome: 'Reminders, greetings, and confirmations reach members on the channel they check 40 times a day.',
    img: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Automatic renewal and reminder messages',
      'Birthday and milestone touches on autopilot',
      'Payment links delivered right in the chat',
      'Delivery visibility on every message',
    ],
    highlight: '98% message open rates',
  },
  {
    id: 'chain',
    category: 'scale',
    badge: 'MULTI-BRANCH',
    title: 'One Business. Every Location.',
    outcome: 'Open one dashboard, see your entire chain — revenue, people, and performance, outlet by outlet.',
    img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=1200&auto=format&fit=crop',
    benefits: [
      'Consolidated and per-branch views of everything',
      'Members move between outlets seamlessly',
      'Compare outlets and spot what works',
      'Enterprise-grade data isolation per business',
    ],
    highlight: 'Your chain, one command center',
  },
];

const PILLARS = [
  {
    icon: '🛡️',
    title: 'Security First',
    desc: 'Bank-grade data isolation means your business data stays yours — protected at the infrastructure level, audited at every sensitive action.',
  },
  {
    icon: '⚡',
    title: 'Speed as a Feature',
    desc: 'Entry decisions, invoice generation, dashboard loads — everything is engineered for the pace of a busy front desk.',
  },
  {
    icon: '🔒',
    title: 'Your Data, Portable',
    desc: 'Full export anytime, in standard formats. We earn retention with value — never with lock-in.',
  },
];

const FAQS = [
  { q: 'Will it work with my existing setup?', a: 'In most cases, yes. Our onboarding team reviews your current devices and processes, then connects everything supported — at no extra cost during setup.' },
  { q: 'How long does setup take?', a: 'Most single gyms go live within a day. Multi-branch chains typically take under a week, including data migration from your old system or spreadsheets.' },
  { q: 'Is my business data safe?', a: 'Your data is isolated at the infrastructure level, every sensitive action is logged, and you can export everything at any time. Security is architectural, not promised.' },
  { q: 'Do you offer demos?', a: 'The 14-day trial IS the demo — full access, no feature locks, no card required. See the real product with your own data.' },
  { q: 'What if I have multiple businesses?', a: 'Each business runs as its own isolated workspace. Switch between them instantly with a single login.' },
];

function MiniCounter({ target, suffix = '', decimals = 0 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        const start = performance.now();
        const dur = 1400;
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
      {val.toFixed(decimals)}{suffix}
    </span>
  );
}

// Spotlight Interactive Component
function SpotlightCard({ children, className = '' }) {
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

export default function FeaturesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFaq, setOpenFaq] = useState(0);
  const [activeSection, setActiveSection] = useState(TOUR[0].id);
  const sectionRefs = useRef({});

  // Initialize Smooth Scrolling with Lenis
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

  // Deep-link support: /features?module=smart-access
  useEffect(() => {
    const mod = searchParams.get('module');
    if (mod && TOUR.find((t) => t.id === mod)) {
      setActiveCategory('all');
      setTimeout(() => {
        sectionRefs.current[mod]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [searchParams]);

  // Scroll-spy for sidebar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.dataset.tourId);
        });
      },
      { rootMargin: '-35% 0px -60% 0px' }
    );
    TOUR.forEach((t) => {
      if (sectionRefs.current[t.id]) observer.observe(sectionRefs.current[t.id]);
    });
    return () => observer.disconnect();
  }, []);

  const filtered = activeCategory === 'all'
    ? TOUR
    : TOUR.filter((t) => t.category === activeCategory);

  const jumpTo = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-lime-400 selection:text-black font-sans antialiased overflow-x-hidden">
      <LandingNavbar />

      {/* ================= HERO ================= */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Animated Radial Glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.22, 0.1],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-lime-400 blur-[150px] rounded-full pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-400 uppercase tracking-widest"
          >
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            Product Tour
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight mt-6 leading-[1.05]"
          >
            Everything Your Gym Runs On.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400">
              Nothing It Doesn't.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-sm sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            A guided walkthrough of every capability — described by what it does
            for your business. The how stays inside the product.
          </motion.p>

          {/* Category tabs with micro-spring */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-10 flex flex-wrap justify-center gap-2"
          >
            {CATEGORIES.map((c) => (
              <motion.button
                key={c.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(c.id)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition border ${
                  activeCategory === c.id
                    ? 'bg-lime-400 text-black border-lime-400 shadow-lg shadow-lime-400/25'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-lime-400/40 hover:text-white'
                }`}
              >
                {c.label}
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================= TOUR ================= */}
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">

          {/* Sticky sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-1">
              <p className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest px-3 mb-3">
                On this page
              </p>
              {TOUR.map((t, i) => (
                <motion.button
                  key={t.id}
                  whileHover={{ x: 4 }}
                  onClick={() => jumpTo(t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-semibold transition border ${
                    activeSection === t.id
                      ? 'bg-zinc-900 border-lime-400/40 text-lime-400 shadow-md'
                      : 'text-zinc-500 hover:text-zinc-200 border-transparent'
                  }`}
                >
                  <span className="font-mono text-[9px] text-zinc-600 mr-2">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {t.badge}
                </motion.button>
              ))}
            </div>
          </aside>

          {/* Tour sections with AnimatePresence */}
          <motion.div layout className="space-y-24 mt-4 lg:mt-0">
            <AnimatePresence mode="popLayout">
              {filtered.map((t, idx) => (
                <motion.article
                  key={t.id}
                  data-tour-id={t.id}
                  ref={(el) => (sectionRefs.current[t.id] = el)}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="scroll-mt-28"
                >
                  <div className="mb-8">
                    <span className="text-[10px] font-mono font-bold text-lime-400 uppercase tracking-[0.2em]">
                      {t.badge}
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight mt-2">
                      {t.title}
                    </h2>
                    <p className="text-sm sm:text-base text-zinc-400 mt-3 max-w-2xl leading-relaxed">
                      {t.outcome}
                    </p>
                  </div>

                  <div className={`grid grid-cols-1 gap-8 ${idx % 2 === 0 ? 'lg:grid-cols-[1.3fr_1fr]' : 'lg:grid-cols-[1fr_1.3fr]'}`}>
                    {/* Image with Tilt & Zoom On Hover */}
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.4 }}
                      className={`rounded-3xl border border-zinc-800 overflow-hidden group shadow-xl ${idx % 2 === 1 ? 'lg:order-2' : ''}`}
                    >
                      <img
                        src={t.img}
                        alt={t.title}
                        loading="lazy"
                        className="w-full h-64 sm:h-80 object-cover group-hover:scale-105 transition duration-700 brightness-90"
                      />
                    </motion.div>

                    {/* Benefits + highlight */}
                    <div className={`flex flex-col justify-center ${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                      <div className="space-y-4">
                        {t.benefits.map((b, bIdx) => (
                          <motion.div
                            key={b}
                            initial={{ opacity: 0, x: -15 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: bIdx * 0.08 }}
                            className="flex items-start gap-3"
                          >
                            <span className="w-5 h-5 rounded-md bg-lime-400/15 text-lime-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                              ✓
                            </span>
                            <p className="text-sm text-zinc-300 leading-relaxed">{b}</p>
                          </motion.div>
                        ))}
                      </div>

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="mt-8 p-5 rounded-2xl bg-lime-400/5 border border-lime-400/20 shadow-[0_0_20px_rgba(163,230,53,0.06)]"
                      >
                        <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                          The result
                        </p>
                        <p className="text-base sm:text-lg font-black text-lime-400 mt-1">
                          {t.highlight}
                        </p>
                      </motion.div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ================= PILLARS (SPOTLIGHT CARDS) ================= */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/60 relative overflow-hidden">
        <div className="absolute -left-40 top-1/4 w-[400px] h-[400px] bg-lime-400/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">
              Built Different
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mt-3">
              Three Promises, Kept in Architecture
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PILLARS.map((p, idx) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
              >
                <SpotlightCard>
                  <span className="text-3xl">{p.icon}</span>
                  <h3 className="text-lg font-black mt-4 text-white">{p.title}</h3>
                  <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{p.desc}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= METRICS COUNTER ================= */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
          {[
            { value: 500, suffix: '+', label: 'Businesses Onboard' },
            { value: 2.4, suffix: 'M+', label: 'Entries Processed', decimals: 1 },
            { value: 98, suffix: '%', label: 'Message Open Rate' },
            { value: 14, suffix: ' days', label: 'Free Full Access' },
          ].map((s, idx) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.12, duration: 0.5 }}
            >
              <p className="text-4xl sm:text-5xl font-black text-lime-400">
                <MiniCounter target={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
              </p>
              <p className="text-[11px] text-zinc-500 mt-2 uppercase tracking-widest font-mono">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ================= FAQ ACCORDION ================= */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">
              Before You Ask
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={f.q} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left text-sm font-bold hover:bg-zinc-900 transition"
                >
                  <span>{f.q}</span>
                  <motion.span
                    animate={{ rotate: openFaq === i ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-lime-400 text-lg shrink-0"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
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
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight">
              Reading About It Is Boring.
              <br />
              <span className="text-lime-400">Try It Live.</span>
            </h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
              Full access for 14 days. Every capability unlocked. Your own data, your own workspace — no card required.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(163,230,53,0.35)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/checkout?plan=Starter%20Solo&cycle=monthly')}
                className="px-10 py-4 rounded-2xl bg-lime-400 text-black font-black text-sm transition"
              >
                Start Your Free Workspace ⚡
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
            <p className="mt-6 text-[11px] font-mono text-zinc-600 uppercase tracking-widest">
              No credit card · Cancel anytime · Data export included
            </p>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}