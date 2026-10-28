import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

function SpotlightContainer({ children, className = '' }) {
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    containerRef.current.style.setProperty('--mouse-x', `${x}px`);
    containerRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative group rounded-3xl border border-zinc-900 bg-zinc-950 p-8 shadow-2xl overflow-hidden transition-all duration-300 hover:border-lime-400/40 hover:shadow-[0_0_35px_rgba(163,230,53,0.12)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(163,230,53,0.14), transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    gym_name: '',
    name: '',
    phone: '',
    city: 'Jaipur',
    branches: '1',
    message: ''
  });

  // Lenis Smooth Scrolling
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-lime-400 selection:text-black font-sans antialiased overflow-x-hidden">
      <LandingNavbar />

      {/* ================= HERO ================= */}
      <section className="relative pt-32 pb-16 px-6 max-w-7xl mx-auto text-center overflow-hidden">
        {/* Animated Background Radial Glow */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.08, 0.2, 0.08],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-lime-400 blur-[150px] rounded-full"
        />

        <div className="relative max-w-3xl mx-auto">
          <motion.span
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-xs font-mono font-bold tracking-widest text-lime-400 uppercase shadow-inner"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
            Sales & Hardware Consultation
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-black text-white mt-4 tracking-tight leading-[1.08]"
          >
            Let's Scale Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400">
              Gym Chain.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto mt-4 leading-relaxed"
          >
            Need custom turnstile installations, migration from legacy software, or multi-franchise pricing? Our technical engineers are here.
          </motion.p>
        </div>
      </section>

      {/* ================= MAIN CONTENT ================= */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative z-10">
        {/* Contact Info Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="md:col-span-5 h-full"
        >
          <SpotlightContainer className="h-full space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Direct Enterprise Desk</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Direct support and edge hardware provisioning for gym franchise networks across India.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1 transition duration-200 hover:border-zinc-700 shadow-sm"
              >
                <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[10px] font-mono">
                  Headquarters
                </span>
                <p className="text-white font-medium">Jaipur, Rajasthan, India</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1 transition duration-200 hover:border-lime-400/40 shadow-sm"
              >
                <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[10px] font-mono">
                  Priority Phone (WhatsApp)
                </span>
                <p className="text-lime-400 font-mono font-bold text-sm tracking-wide">+91 98765 43210</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1 transition duration-200 hover:border-zinc-700 shadow-sm"
              >
                <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[10px] font-mono">
                  Technical Support
                </span>
                <p className="text-zinc-200 font-mono">support@gymmanager.com</p>
              </motion.div>
            </div>

            <div className="pt-3 border-t border-zinc-900 flex items-start gap-2.5 text-zinc-500 text-[11px] leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shrink-0 mt-1" />
              <span>
                Hardware onsite technicians available for Jaipur, Delhi NCR, Mumbai, Bangalore, and Chandigarh.
              </span>
            </div>
          </SpotlightContainer>
        </motion.div>

        {/* Lead Form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="md:col-span-7"
        >
          <SpotlightContainer>
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-12 space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="w-14 h-14 rounded-full bg-lime-400 text-black flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-lime-400/30"
                  >
                    ✓
                  </motion.div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Consultation Request Received!
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Our technical implementation lead will connect with you on WhatsApp within 30 minutes to arrange your walkthrough.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSubmitted(false)}
                    className="mt-4 px-6 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 font-semibold hover:border-lime-400/40 hover:text-white transition"
                  >
                    Send another message
                  </motion.button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        Gym Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Iron Force Fitness"
                        value={form.gym_name}
                        onChange={(e) => setForm({ ...form, gym_name: e.target.value })}
                        className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Vikram Singh"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        WhatsApp Mobile *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 font-mono transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        Outlets / Branches
                      </label>
                      <select
                        value={form.branches}
                        onChange={(e) => setForm({ ...form, branches: e.target.value })}
                        className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 font-semibold transition cursor-pointer"
                      >
                        <option value="1">1 Single Gym</option>
                        <option value="2-4">2 - 4 Outlets</option>
                        <option value="5+">5+ Franchise Network</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Requirements / Message
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Need turnstile hardware quotes, legacy Excel data migration..."
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition resize-none"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(163,230,53,0.35)' }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="w-full py-4 rounded-xl bg-lime-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-lime-400/20"
                  >
                    Schedule Technical Walkthrough ⚡
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </SpotlightContainer>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  );
}