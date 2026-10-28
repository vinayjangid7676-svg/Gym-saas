import React, { useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingNavbar() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredPath, setHoveredPath] = useState(null);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/features', label: 'Platform Features' },
    { to: '/hardware', label: 'Turnstiles & IoT' },
    { to: '/pricing', label: 'Plans & Pricing' },
    { to: '/contact', label: 'Talk to Sales' },
  ];

  return (
    <>
      {/* Top Banner with subtle pulse */}
      <div className="bg-zinc-950 border-b border-zinc-900 py-2 px-4 text-center text-xs text-zinc-400 font-medium">
        ⚡ Enterprise SaaS 2.0 Live ·{' '}
        <span className="text-lime-400 font-bold">14-Day Free Access</span> for gym owners & chains across India.
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/85 border-b border-zinc-900/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Logo with Spring Hover */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center shadow-lg shadow-lime-400/25"
            >
              <span className="text-black font-black text-2xl tracking-tighter">G</span>
            </motion.div>
            <div>
              <span className="text-lg font-black tracking-tight text-white block leading-none">
                GYMORA<span className="text-lime-400">OS</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Cloud Enterprise</span>
            </div>
          </Link>

          {/* Desktop Navigation with Floating Hover Capsule */}
          <nav
            onMouseLeave={() => setHoveredPath(null)}
            className="hidden lg:flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-950/70 border border-zinc-800/80 text-xs font-bold uppercase tracking-wider"
          >
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={() => setHoveredPath(item.to)}
                className={({ isActive }) =>
                  `relative px-4 py-2 transition-colors duration-200 z-10 flex items-center gap-1.5 ${
                    isActive ? 'text-lime-400 font-black' : 'text-zinc-400 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="activeDot"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_#a3e635]"
                      />
                    )}
                    {hoveredPath === item.to && (
                      <motion.div
                        layoutId="navHover"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        className="absolute inset-0 bg-zinc-900/90 rounded-full -z-10 border border-zinc-800"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-bold text-zinc-300 hover:text-white transition"
            >
              Client Login
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(163,230,53,0.35)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/checkout?plan=Starter%20Solo&cycle=monthly')}
              className="px-5 py-2.5 rounded-xl bg-lime-400 text-black text-xs font-black transition shadow-lg shadow-lime-400/20"
            >
              Start 14-Day Trial →
            </motion.button>
          </div>

          {/* Mobile Menu Hamburger with Animated SVG Path */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white rounded-lg focus:outline-none"
            aria-label="Toggle Navigation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                animate={mobileMenuOpen ? { d: 'M6 18L18 6' } : { d: 'M4 6h16' }}
                transition={{ duration: 0.25 }}
              />
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                animate={mobileMenuOpen ? { opacity: 0 } : { opacity: 1, d: 'M4 12h16' }}
                transition={{ duration: 0.2 }}
              />
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                animate={mobileMenuOpen ? { d: 'M6 6l12 12' } : { d: 'M4 18h16' }}
                transition={{ duration: 0.25 }}
              />
            </svg>
          </motion.button>
        </div>

        {/* Mobile Dropdown with AnimatePresence */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden lg:hidden bg-zinc-950/95 backdrop-blur-2xl border-b border-zinc-900 px-6 py-6"
            >
              <div className="space-y-3">
                {navLinks.map((item, index) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.3 }}
                  >
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `block text-sm font-bold py-1.5 transition-colors ${
                          isActive ? 'text-lime-400 pl-2 border-l-2 border-lime-400' : 'text-zinc-300 hover:text-white'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="pt-6 mt-4 border-t border-zinc-800/80 flex flex-col gap-2.5"
              >
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-bold hover:bg-zinc-800 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/checkout?plan=Starter%20Solo&cycle=monthly');
                  }}
                  className="w-full py-3 rounded-xl bg-lime-400 text-black text-xs font-black hover:bg-lime-300 transition shadow-lg shadow-lime-400/20"
                >
                  Start 14-Day Free Trial
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}