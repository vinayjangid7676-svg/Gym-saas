import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranch } from '../context/BranchContext';

/* Inline SVG Icons */
const Icons = {
  menu: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  ),
  search: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  bell: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  plus: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  ),
  chevron: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  user: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  shield: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  logout: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  location: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
};

export default function Header({ activeTab, onQuickAdd, onMenuClick, user, onLogout }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Global Multi-Branch Context
  const { branches, activeBranch, switchBranch } = useBranch();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigateProfile = () => {
    setProfileOpen(false);
    navigate('/profile');
  };

  const handleLogoutClick = () => {
    setProfileOpen(false);
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between gap-1.5 px-2.5 sm:px-4 md:px-6 lg:px-8">

        {/* ---------- Left: Hamburger Button + Tab Title ---------- */}
        <div className="flex shrink-0 min-w-0 items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={onMenuClick}
            type="button"
            aria-label="Open sidebar"
            className="shrink-0 rounded-xl p-2 text-zinc-300 transition hover:bg-zinc-800 hover:text-white active:scale-95 lg:hidden"
          >
            <Icons.menu className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          <div className="min-w-0 max-w-[85px] xs:max-w-[120px] sm:max-w-[200px] md:max-w-none">
            <h2 className="truncate text-xs font-bold capitalize text-white sm:text-base md:text-lg">
              {activeTab}
            </h2>
            <p className="hidden text-[10px] text-zinc-500 md:block font-medium">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* ---------- Right: Compact Branch Switcher + Action Buttons + Profile ---------- */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">

          {/* 🏢 COMPACT & RESPONSIVE GLOBAL BRANCH SWITCHER */}
          {branches.length > 0 && (
            <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 py-1 px-1.5 sm:px-2.5 sm:py-1.5 transition hover:border-zinc-700">
              <Icons.location className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-lime-400 shrink-0" />
              <div className="relative max-w-[70px] xs:max-w-[95px] sm:max-w-[140px] md:max-w-[180px]">
                <select
                  aria-label="Select active gym branch"
                  value={activeBranch?.id || ''}
                  onChange={(e) => switchBranch(e.target.value)}
                  className="w-full bg-transparent text-[11px] sm:text-xs font-bold text-white focus:outline-none cursor-pointer truncate pr-3 appearance-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-zinc-950 text-white">
                      {b.code || b.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-zinc-500">
                  <span className="text-[8px]">▼</span>
                </div>
              </div>
            </div>
          )}

          {/* Search — Desktop Expansion */}
          <div className="hidden items-center md:flex">
            <div className="relative">
              <Icons.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                className="w-36 lg:w-52 rounded-xl border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-zinc-500 outline-none transition focus:w-60 focus:border-lime-400/50"
              />
            </div>
          </div>

          {/* Mobile Search Toggle Icon */}
          <button
            onClick={() => setSearchOpen((v) => !v)}
            type="button"
            aria-label="Search"
            className="rounded-xl p-1.5 sm:p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white md:hidden"
          >
            <Icons.search className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Quick Add Member Button (Icon on mobile, Full text on desktop) */}
          <button
            onClick={onQuickAdd}
            aria-label="Quick Add Member"
            className="flex items-center justify-center gap-1 rounded-xl bg-lime-400 p-1.5 sm:px-3 sm:py-2 text-xs font-bold text-zinc-950 shadow-sm shadow-lime-400/20 transition hover:bg-lime-300 active:scale-95"
          >
            <Icons.plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Add Member</span>
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative rounded-xl p-1.5 sm:p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <Icons.bell className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-lime-400 ring-2 ring-zinc-950" />
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              type="button"
              aria-label="Profile menu"
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1 sm:py-1.5 sm:pl-1.5 sm:pr-2 transition hover:border-zinc-700 focus:outline-none"
            >
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-lime-400 text-xs sm:text-sm font-black text-zinc-950 shadow-sm">
                {(user?.name || 'G').charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[70px] lg:max-w-[100px] truncate text-xs font-semibold text-white md:block">
                {(user?.name || 'Owner').split(' ')[0]}
              </span>
              <Icons.chevron
                className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 hidden xs:block ${profileOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 sm:w-64 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
                {/* Header User Preview */}
                <div 
                  onClick={handleNavigateProfile}
                  className="cursor-pointer border-b border-zinc-800/80 px-4 py-3 transition hover:bg-zinc-800/50"
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs sm:text-sm font-bold text-white">
                      {user?.name || 'Gym User'}
                    </p>
                    <span className="rounded-full bg-lime-400/10 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-lime-400 border border-lime-400/20">
                      {user?.role || 'Active'}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-zinc-400 font-mono mt-0.5">
                    {user?.phone || user?.email || 'Logged In'}
                  </p>
                  {user?.organization_name && (
                    <p className="truncate text-[10px] text-zinc-500 mt-1 font-medium">
                      🏢 {user.organization_name}
                    </p>
                  )}
                </div>

                {/* Dropdown Options */}
                <div className="p-1.5 space-y-0.5 sm:space-y-1">
                  <button
                    onClick={handleNavigateProfile}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                  >
                    <Icons.user className="h-4 w-4 text-lime-400" />
                    <span>My Profile & Settings</span>
                  </button>
                  <button
                    onClick={handleNavigateProfile}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                  >
                    <Icons.shield className="h-4 w-4 text-zinc-400" />
                    <span>Security & Password</span>
                  </button>
                </div>

                <div className="border-t border-zinc-800/80 p-1.5">
                  <button
                    onClick={handleLogoutClick}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Icons.logout className="h-4 w-4" />
                    <span>Logout Account</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Input Drawer */}
      {searchOpen && (
        <div className="border-t border-zinc-800 px-3 py-2 md:hidden bg-zinc-950">
          <div className="relative">
            <Icons.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              autoFocus
              type="text"
              placeholder="Search members, invoices..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-1.5 pl-9 pr-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-lime-400/50"
            />
          </div>
        </div>
      )}
    </header>
  );
}