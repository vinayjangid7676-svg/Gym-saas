import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';

/* ================================================================
   GYMORA SaaS - Hardware & Access Control Page (HardwarePage.jsx)
   Theme: Midnight Black + Electric Lime
   ================================================================ */

const DEVICES = [
  {
    tag: 'PHYSICAL SECURITY',
    title: 'Flap Barriers & Turnstiles',
    desc: 'Compatible with ZKTeco, Essl & Hikvision relay turnstiles. If an athlete membership has expired, the relay lock does not trigger — unpaid guests simply cannot walk in.',
    img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=800&auto=format&fit=crop',
    specs: ['Wiegand / RS-485 relay output', 'Dry-contact gate trigger', 'Anti-tailgating direction control'],
  },
  {
    tag: 'FACIAL AI',
    title: 'Face Recognition Terminals',
    desc: 'High-speed optical recognition. Members walk past the tablet camera at the gate and verify attendance instantly — no card, no phone, no touching anything.',
    img: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=800&auto=format&fit=crop',
    specs: ['<0.3s face match speed', 'Mask & low-light tolerant', 'Liveness anti-spoof detection'],
  },
  {
    tag: 'ANTI-PASSBACK',
    title: 'Dynamic Anti-Screenshot QR',
    desc: 'Member mobile app regenerates a dynamic TOTP QR code every 15 seconds. Screenshots forwarded to friends fail instantly at the scanner — buddy-swipe fraud eliminated.',
    img: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop',
    specs: ['15-second TOTP rotation', 'Server-side signature verify', 'Offline validation cache'],
  },
  {
    tag: 'FINGERPRINT BIOMETRICS',
    title: 'Fingerprint Access Scanners',
    desc: 'Capacitive fingerprint readers synced to member profiles. Credential hashes are stored server-side — devices never hold raw biometric data, keeping you compliant.',
    img: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=800&auto=format&fit=crop',
    specs: ['Encrypted credential hash sync', 'Template revocation in 1-click', 'Works with Essl / ZKTeco readers'],
  },
  {
    tag: 'RFID / NFC',
    title: 'RFID Wristbands & Cards',
    desc: 'Issue branded wristbands or key-cards mapped to each member barcode_rfid. Perfect for pools, saunas & premium clubs where phones are not carried.',
    img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=800&auto=format&fit=crop',
    specs: ['13.56 MHz MIFARE support', 'Instant deactivation on expiry', 'Bulk card issuance wizard'],
  },
  {
    tag: 'FRONT DESK KIOSK',
    title: 'Manual Check-in Tablets',
    desc: 'Reception-mode tablet for visitors, trial members and manual overrides. Every manual entry is audit-logged with staff identity and reason code.',
    img: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?q=80&w=800&auto=format&fit=crop',
    specs: ['Staff-override with reason codes', 'Visitor & trial pass mode', 'Full audit trail logging'],
  },
];

const VERIFICATION_STEPS = [
  { step: '01', title: 'Credential Scan', desc: 'Device captures QR / fingerprint / face / RFID and fires a signed payload to the GYMORA edge API over LAN.' },
  { step: '02', title: '<150ms Membership Check', desc: 'GYMORA validates active membership, freeze status, blacklist flags and branch access rules against PostgreSQL in real time.' },
  { step: '03', title: 'Gate Relay Decision', desc: 'Approved → dry-contact relay opens the flap barrier. Denied → red LED + buzzer, denial reason logged, WhatsApp renewal link sent.' },
  { step: '04', title: 'Attendance Recorded', desc: 'Check-in timestamp, device ID, method & direction persist to the attendance ledger — synced to dashboards instantly.' },
];

const SPEC_ROWS = [
  { label: 'Verification Latency', value: '< 150 ms (LAN relay)' },
  { label: 'Offline Buffer', value: '10,000+ events on-device queue' },
  { label: 'Sync Strategy', value: 'Store-and-forward on reconnect' },
  { label: 'Auth Model', value: 'Per-device API token (hashed)' },
  { label: 'Heartbeat', value: '30s telemetry ping to console' },
  { label: 'Denial Logging', value: 'Full reason code + timestamp' },
  { label: 'Credential Storage', value: 'Server-side hash only (no raw biometrics)' },
  { label: 'Directions', value: 'Bidirectional / Entry-only / Exit-only' },
];

const COMPATIBILITY = ['ZKTeco', 'Essl (eSSL)', 'Hikvision', 'Dahua', 'HID Global', 'Suprema', 'Anviz', 'Custom Wiegand Controllers'];

const STATS = [
  { value: 150, suffix: 'ms', label: 'Gate Decision Time' },
  { value: 99.98, suffix: '%', label: 'Uptime (Offline Buffer)', decimals: 2 },
  { value: 100, suffix: '%', label: 'Buddy-Swipe Blocked' },
  { value: 4, suffix: '+', label: 'Credential Modes' },
];

const FAQS = [
  { q: 'Kya mera purana Essl ya ZKTeco turnstile GYMORA se connect ho jayega?', a: 'Haan. GYMORA Wiegand / RS-485 relay interface use karta hai. Aapke existing Essl, ZKTeco ya Hikvision gate controller ko hamara edge hub se 2-wire relay me jod diya jata hai — no hardware replacement needed.' },
  { q: 'Internet chala jaye to gate kaam karega?', a: 'Bilkul. Edge hub locally cached membership whitelist (signature-verified) pe operate karta hai aur 10,000+ events queue karke internet wapas aane par PostgreSQL me sync kar deta hai.' },
  { q: 'Kya member ka fingerprint data secure hai?', a: 'Devices kabhi raw biometric store nahi karte. Sirf encrypted credential hashes GYMORA servers pe hote hain, jo 1-click me revoke ho sakte hain — privacy by design.' },
  { q: 'Dynamic QR kaise fraud rokta hai?', a: 'Member app ka QR har 15 second me TOTP algorithm se regenerate hota hai. Screenshot ya forwarded image instantly invalid ho jati hai — isliye "buddy swipe" impossible hai.' },
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

// Spotlight Interactive Card Component
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
      className={`relative group rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all duration-300 hover:border-lime-400/50 hover:shadow-[0_0_35px_rgba(163,230,53,0.14)] overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(350px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(163,230,53,0.16), transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}

export default function HardwarePage() {
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState(0);

  // Initialize Lenis Smooth Scrolling
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

  return (
    <div className="min-h-screen bg-black text-white selection:bg-lime-400 selection:text-black font-sans antialiased overflow-x-hidden">
      <LandingNavbar />

      {/* ================= HERO ================= */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Animated Radial Backdrop Glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.22, 0.1],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-lime-400 blur-[150px] rounded-full pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            Biometrics & Access Gateways — GYMORA Edge Network
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]"
          >
            Hardware That Enforces
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-400">
              Gym Discipline.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            Eliminate unpaid guests and buddy-swipes forever. Integrate your turnstiles, fingerprint
            scanners and face-recognition terminals with sub-150ms verification — online or offline.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(163,230,53,0.35)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/checkout?plan=Starter%20Solo&cycle=monthly')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-lime-400 text-black font-black text-sm transition"
            >
              Start 14-Day Free Trial ⚡
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/features')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm border border-zinc-800 transition"
            >
              Explore Software Features →
            </motion.button>
          </motion.div>

          {/* Hero visual card */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="mt-16 relative rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl group"
          >
            <img
              src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=1600&auto=format&fit=crop"
              alt="Gym entry gate with GYMORA access control"
              className="w-full h-80 sm:h-[460px] object-cover brightness-[0.4] group-hover:scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-8 sm:p-12 text-left">
              <span className="text-xs font-mono font-bold text-lime-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping inline-block" />
                Live Edge Verification
              </span>
              <h3 className="text-2xl sm:text-4xl font-black mt-2 max-w-2xl text-white">
                Every Gate Decision. Logged, Timed & Auditable.
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mt-2 max-w-lg">
                Entry, exit, denial reason, device health — every event lands in your GYMORA console
                with a tamper-proof audit trail.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="border-y border-zinc-900 bg-zinc-950/60">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
          {STATS.map((s, idx) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.12, duration: 0.5 }}
            >
              <p className="text-4xl sm:text-5xl font-black text-lime-400">
                <AnimatedCounter target={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
              </p>
              <p className="text-xs text-zinc-500 mt-2 uppercase tracking-widest font-mono">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ================= DEVICE GRID ================= */}
      <section className="py-24 bg-zinc-950/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Device Ecosystem</h2>
            <p className="text-3xl sm:text-5xl font-black tracking-tight mt-2">
              One Hub. Every Gate Technology.
            </p>
            <p className="text-zinc-400 text-sm mt-4">
              Mix and match credential modes per branch — fingerprint at the main gate, QR at the
              studio, RFID wristbands at the pool.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEVICES.map((d, idx) => (
              <motion.div
                key={d.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="h-full"
              >
                <SpotlightCard className="h-full space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="relative overflow-hidden rounded-2xl mb-4">
                      <img
                        src={d.img}
                        alt={d.title}
                        className="w-full h-44 object-cover group-hover:scale-105 transition duration-500"
                        loading="lazy"
                      />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur text-[10px] font-mono font-bold text-lime-400 uppercase tracking-widest border border-lime-400/20">
                        {d.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{d.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-2">{d.desc}</p>
                  </div>
                  <ul className="space-y-2 pt-2 border-t border-zinc-800/80">
                    {d.specs.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= VERIFICATION PIPELINE ================= */}
      <section className="py-24 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">The Edge Pipeline</h2>
            <p className="text-3xl sm:text-5xl font-black mt-2">Scan → Verify → Open → Log</p>
            <p className="text-zinc-400 text-sm mt-4 max-w-xl mx-auto">
              Four deterministic stages between a member touching the gate and your ledger updating.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VERIFICATION_STEPS.map((w, idx) => (
              <motion.div
                key={w.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
                whileHover={{ y: -6 }}
                className="relative p-7 rounded-3xl bg-zinc-900/40 border border-zinc-800 hover:border-lime-400/40 transition-all duration-300 shadow-lg"
              >
                <span className="text-5xl font-black text-lime-400/15">{w.step}</span>
                <h3 className="text-base font-bold mt-3 text-white">{w.title}</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TECH SPECS TABLE ================= */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Engineering Specs</h2>
            <p className="text-3xl sm:text-4xl font-black mt-2">Built For Production Loads</p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl backdrop-blur-sm"
          >
            <table className="w-full text-sm">
              <tbody>
                {SPEC_ROWS.map((r, i) => (
                  <tr
                    key={r.label}
                    className={`transition-colors hover:bg-zinc-800/40 ${
                      i % 2 === 0 ? 'bg-zinc-900/40' : 'bg-black/40'
                    }`}
                  >
                    <td className="px-6 py-4 text-zinc-400 text-xs font-mono uppercase tracking-wide border-b border-zinc-900">
                      {r.label}
                    </td>
                    <td className="px-6 py-4 text-right text-lime-400 font-bold text-xs font-mono border-b border-zinc-900">
                      {r.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Compatibility strip */}
          <div className="mt-12">
            <p className="text-center text-xs font-mono text-zinc-500 uppercase tracking-widest mb-5">
              Works With Your Existing Hardware
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {COMPATIBILITY.map((c) => (
                <motion.span
                  key={c}
                  whileHover={{ scale: 1.05 }}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:border-lime-400/50 hover:text-lime-400 transition cursor-default shadow-md"
                >
                  {c}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= OFFLINE FAIL-SAFE ================= */}
      <section className="py-24 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">Resilience Layer</h2>
            <h3 className="text-3xl sm:text-4xl font-black mt-2 leading-tight">
              Internet Down? Your Gates Never Stop.
            </h3>
            <p className="text-zinc-400 text-sm mt-4 leading-relaxed">
              GYMORA edge hubs carry a cryptographically signed, time-boxed membership whitelist.
              Broadband failure, router reboot, ISP outage — the flap barriers keep verifying and
              buffer up to 10,000 access events, then sync atomically to PostgreSQL once the
              network returns. Zero lost attendance. Zero unpaid entries.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Local relay buffer with signed whitelist sync',
                'Automatic conflict resolution on reconnection',
                'Device heartbeat + offline alerts to owner WhatsApp',
              ].map((p, pIdx) => (
                <motion.li
                  key={p}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: pIdx * 0.1, duration: 0.4 }}
                  className="flex items-start gap-3 text-xs text-zinc-300"
                >
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-lime-400/15 border border-lime-400/40 flex items-center justify-center text-lime-400 text-[9px] font-black shrink-0">
                    ✓
                  </span>
                  {p}
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl group"
          >
            <img
              src="https://images.unsplash.com/photo-1517963879433-6ad2b056d712?q=80&w=1200&auto=format&fit=crop"
              alt="Gym hardware network room"
              className="w-full h-80 object-cover brightness-75 group-hover:scale-105 transition duration-700"
              loading="lazy"
            />
          </motion.div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-xs font-mono font-bold tracking-widest text-lime-400 uppercase">FAQ</h2>
            <p className="text-3xl sm:text-4xl font-black mt-2">Hardware Questions, Answered.</p>
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
                    className="text-lime-400 text-lg shrink-0"
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
                      <p className="px-6 pb-5 text-xs text-zinc-400 leading-relaxed">{f.a}</p>
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
              Lock Your Gates. <span className="text-lime-400">Unlock Revenue.</span>
            </h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
              Plug GYMORA into your existing turnstiles in under a day. Free trial includes edge hub
              configuration support.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(163,230,53,0.35)' }}
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
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}