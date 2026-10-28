import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-zinc-900 bg-black text-zinc-500 text-xs py-16 px-6 overflow-hidden">
      {/* Subtle top edge lime ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-[1px] bg-gradient-to-r from-transparent via-lime-400/30 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-10">
        
        {/* Brand Column */}
        <div className="md:col-span-2 space-y-4">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="w-8 h-8 rounded-lg bg-lime-400 flex items-center justify-center text-black font-black text-lg shadow-md shadow-lime-400/20"
            >
              G
            </motion.div>
            <span className="text-white font-black text-base tracking-tight group-hover:text-lime-400 transition-colors">
              GYMORA<span className="text-lime-400">OS</span>
            </span>
          </Link>
          <p className="text-zinc-400 max-w-sm text-xs leading-relaxed">
            The mission-critical operating system for commercial gyms, fitness chains, and boutique studios across India. Zero fee leakages, automated biometric access, and complete multi-branch management.
          </p>
          <div className="pt-2 text-zinc-600 font-mono text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
            <span>Cloud Infrastructure: ISO-27001 & 256-bit AES Tenant Isolation.</span>
          </div>
        </div>

        {/* Product Column */}
        <div>
          <h4 className="text-white font-bold uppercase tracking-wider mb-4 text-[11px] font-mono">
            Product Hub
          </h4>
          <ul className="space-y-2.5">
            {[
              { to: '/features', label: 'Multi-Branch Sync' },
              { to: '/features', label: 'AI Diet & Workout Engine' },
              { to: '/hardware', label: 'Biometric Turnstiles' },
              { to: '/features', label: 'POS Supplement Store' },
              { to: '/features', label: 'Staff & Trainer Payroll' },
            ].map((link) => (
              <li key={link.label}>
                <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  <Link to={link.to} className="hover:text-lime-400 transition-colors inline-block">
                    {link.label}
                  </Link>
                </motion.div>
              </li>
            ))}
          </ul>
        </div>

        {/* Plans & Company Column */}
        <div>
          <h4 className="text-white font-bold uppercase tracking-wider mb-4 text-[11px] font-mono">
            Plans & Company
          </h4>
          <ul className="space-y-2.5">
            {[
              { to: '/pricing', label: 'Pricing Tiers' },
              { to: '/contact', label: 'Enterprise Demo' },
              { to: '/contact', label: 'Hardware Installation' },
              { to: '/contact', label: 'Partner Program' },
            ].map((link) => (
              <li key={link.label}>
                <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  <Link to={link.to} className="hover:text-lime-400 transition-colors inline-block">
                    {link.label}
                  </Link>
                </motion.div>
              </li>
            ))}
          </ul>
        </div>

        {/* Portals & Security Column */}
        <div>
          <h4 className="text-white font-bold uppercase tracking-wider mb-4 text-[11px] font-mono">
            Portals & Security
          </h4>
          <ul className="space-y-2.5">
            <li>
              <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                <a href="/login" className="hover:text-white transition-colors inline-block">
                  Gym Owner Desk
                </a>
              </motion.div>
            </li>
            <li>
              <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                <a href="/admin/login" className="hover:text-red-400 transition-colors inline-block">
                  Super Admin Console
                </a>
              </motion.div>
            </li>
            <li>
              <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                <Link to="/contact" className="hover:text-white transition-colors inline-block">
                  24x7 Priority Support
                </Link>
              </motion.div>
            </li>
            <li className="pt-1">
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                99.98% System Uptime
              </span>
            </li>
          </ul>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto pt-12 mt-12 border-t border-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-600 font-mono">
        <p>© {currentYear} GYMORA Inc. All rights reserved. Made for high-performance fitness hubs.</p>
        <div className="flex gap-6">
          <Link to="/contact" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link to="/contact" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          <Link to="/contact" className="hover:text-zinc-400 transition-colors">Security Audit</Link>
        </div>
      </div>
    </footer>
  );
}