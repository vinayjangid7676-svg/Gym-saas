import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../api';
import { useBranchId } from './inventory/InventoryShared';

/* ------------------------------------------------------------------ */
/*  Inline Icon Set                                                   */
/* ------------------------------------------------------------------ */
const Icon = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);
const IconLocker = (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h6" /><circle cx="15.5" cy="13" r="1" /><path d="M9 21v-4" /></Icon>;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
const IconClose = (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
const IconUser = (p) => <Icon {...p}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></Icon>;
const IconRupee = (p) => <Icon {...p}><path d="M7 5h10M7 5c5 0 7 1.6 7 4.2S12 13.4 7 13.4M7 9.5h10M7 13.4 15 20" /></Icon>;
const IconCheck = (p) => <Icon {...p}><path d="M4 12.5 9.5 18 20 6" /></Icon>;
const IconAlert = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.2v.1" /></Icon>;
const IconUnlock = (p) => <Icon {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.5-2" /></Icon>;
const IconBuilding = (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h1M8 11h1M8 15h1M15 7h1M15 11h1M15 15h1" /></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>;

/* ------------------------------------------------------------------ */
/*  Shared Style Tokens                                               */
/* ------------------------------------------------------------------ */
const inputCls =
  'w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/10 focus:outline-none transition-colors';
const readOnlyInputCls =
  'w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-zinc-400 cursor-not-allowed';
const labelCls = 'text-[11px] text-zinc-500 block mb-1.5 font-medium tracking-wide';
const fieldWrapCls = 'relative';
const fieldIconCls = 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none';

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function LockersPage() {
  const navigate = useNavigate();
  const getBranchId = useBranchId();

  const [branches, setBranches] = useState([]);
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);

  // View state: 'grid' | 'table'
  const [viewTab, setViewTab] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-resolved branch ID
  const initialBranch = getBranchId() || localStorage.getItem('branch_id') || '4';
  const [branchId, setBranchId] = useState(String(initialBranch));

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Form states
  const [lockerNumber, setLockerNumber] = useState('');
  const [branchPricingForm, setBranchPricingForm] = useState({
    default_monthly_rent: '0',
    default_security_deposit: '0',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ─── Direct Data Fetch for Branch ───
  const fetchData = useCallback(async (activeBranchId) => {
    const bId = activeBranchId || branchId;
    if (!bId) return;

    setLoading(true);
    try {
      const [lockersRes, pricingRes] = await Promise.all([
        apiGet(`/api/v1/lockers?branch_id=${bId}`).catch(() => ({ success: false, data: [] })),
        apiGet(`/api/v1/lockers/pricing?branch_id=${bId}`).catch(() => ({ success: false, data: null })),
      ]);

      if (lockersRes?.success) setLockers(lockersRes.data || []);
      if (pricingRes?.success && pricingRes.data) {
        setBranchPricingForm({
          default_monthly_rent: String(pricingRes.data.default_monthly_rent ?? '0'),
          default_security_deposit: String(pricingRes.data.default_security_deposit ?? '0'),
        });
      }
    } catch (err) {
      console.error('Failed to load locker data', err);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  // ─── Initial Load & Auto Branch Detection ───
  useEffect(() => {
    const initBranches = async () => {
      try {
        const branchesRes = await apiGet('/api/v1/branches').catch(() => ({ success: false, data: [] }));
        let list = branchesRes?.data || [];

        if (!list.length) {
          const rawUser = localStorage.getItem('gym_user');
          const parsed = rawUser ? JSON.parse(rawUser) : null;
          const uId = parsed?.branch_id || parsed?.branchId || initialBranch;
          list = [{ id: parseInt(uId, 10) || 4, name: 'Main Branch', code: 'MAIN' }];
        }
        setBranches(list);

        const currentActive = String(list[0]?.id || initialBranch);
        setBranchId(currentActive);
        await fetchData(currentActive);
      } catch (err) {
        console.error('Branch init failed:', err);
      }
    };

    initBranches();
  }, [fetchData, initialBranch]);

  // Handle Manual Branch Switch
  const handleBranchChange = async (e) => {
    const newBId = e.target.value;
    setBranchId(newBId);
    await fetchData(newBId);
  };

  // 1. Create Physical Locker
  const handleCreateLocker = async (e) => {
    e.preventDefault();
    if (!branchId || !lockerNumber) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const res = await apiPost('/api/v1/lockers', {
      branch_id: parseInt(branchId, 10),
      locker_number: lockerNumber.trim(),
    });

    if (res?.success) {
      setMessage({ type: 'success', text: 'Locker unit successfully registered!' });
      setLockerNumber('');
      setShowCreateModal(false);
      fetchData(branchId);
    } else {
      setMessage({ type: 'error', text: res?.message || 'Failed to create locker.' });
    }
    setSubmitting(false);
  };

  // 2. Redirect to Billing (Enforces Audit & Invoice Single Source of Truth)
  const handleBookViaBilling = (locker) => {
    if (locker.pricing_unconfigured) {
      alert('Pehle "Locker Pricing" button se is branch ki rent & deposit setting configure karein.');
      return;
    }
    navigate('/billing/create-invoice', {
      state: {
        prefilledLocker: {
          locker_id: locker.id,
          locker_number: locker.locker_number,
          monthly_rent: locker.effective_monthly_rent,
          security_deposit: locker.effective_security_deposit,
          branch_id: locker.branch_id || parseInt(branchId, 10)
        }
      }
    });
  };

  // 3. Handle Vacate Locker
  const handleVacate = async (lockerId) => {
    if (!window.confirm('Kya aap sure hain ki is locker ko vacate karna chahte hain?')) return;

    const res = await apiPost('/api/v1/lockers/vacate', { locker_id: lockerId });
    if (res?.success) {
      setMessage({ type: 'success', text: 'Locker vacated and marked available again.' });
      fetchData(branchId);
    } else {
      setMessage({ type: 'error', text: res?.message || 'Failed to vacate locker.' });
    }
  };

  // 4. Handle Branch Pricing Save
  const handleSavePricing = async (e) => {
    e.preventDefault();
    if (!branchId) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const res = await apiPut('/api/v1/lockers/pricing', {
      branch_id: parseInt(branchId, 10),
      default_monthly_rent: parseFloat(branchPricingForm.default_monthly_rent || 0),
      default_security_deposit: parseFloat(branchPricingForm.default_security_deposit || 0),
    });

    if (res?.success) {
      setMessage({ type: 'success', text: 'Branch locker pricing updated. Naye lockers isi rate par invoice honge.' });
      setShowPricingModal(false);
      fetchData(branchId);
    } else {
      setMessage({ type: 'error', text: res?.message || 'Pricing update failed.' });
    }
    setSubmitting(false);
  };

  // Filtered Lockers List based on Search
  const filteredLockers = useMemo(() => {
    if (!searchQuery.trim()) return lockers;
    const q = searchQuery.toLowerCase();
    return lockers.filter((l) => {
      const matchNumber = String(l.locker_number).toLowerCase().includes(q);
      const matchMember = (l.first_name && l.first_name.toLowerCase().includes(q)) ||
                          (l.last_name && l.last_name.toLowerCase().includes(q)) ||
                          (l.member_code && l.member_code.toLowerCase().includes(q));
      return matchNumber || matchMember;
    });
  }, [lockers, searchQuery]);

  // Occupied Lockers for Table View
  const occupiedLockersList = useMemo(() => {
    return filteredLockers.filter((l) => l.status === 'occupied');
  }, [filteredLockers]);

  // Helper to calculate days remaining
  const getRemainingDaysInfo = (endDateStr) => {
    if (!endDateStr) return { text: 'Ongoing', isWarning: false, isExpired: false };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Expired (${Math.abs(diffDays)}d ago)`, isWarning: true, isExpired: true };
    }
    if (diffDays <= 7) {
      return { text: `${diffDays} days left`, isWarning: true, isExpired: false };
    }
    return { text: `${diffDays} days left`, isWarning: false, isExpired: false };
  };

  const totalCount = lockers.length;
  const availableCount = lockers.filter((l) => l.status === 'available').length;
  const occupiedCount = lockers.filter((l) => l.status === 'occupied').length;
  const occupancyPct = totalCount ? Math.round((occupiedCount / totalCount) * 100) : 0;
  const unconfiguredCount = lockers.filter((l) => l.pricing_unconfigured).length;

  const currentBranch = branches.find((b) => String(b.id) === String(branchId));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime-400 to-lime-500 flex items-center justify-center text-zinc-950 shadow-[0_0_24px_-6px] shadow-lime-400/60 shrink-0">
            <IconLocker className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Locker Management</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Physical locker inventory, occupancy status, aur POS billing integration.</p>
          </div>
        </div>

        {/* Branch Controls & Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="min-w-[190px]">
            {branches.length > 1 ? (
              <div className={fieldWrapCls}>
                <IconBuilding className={fieldIconCls} />
                <select
                  value={branchId}
                  onChange={handleBranchChange}
                  className={`${inputCls} font-medium text-lime-400`}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code || 'MAIN'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono flex items-center gap-2">
                <IconBuilding className="w-3.5 h-3.5 text-lime-400" />
                <span className="text-zinc-200 font-bold truncate">
                  {currentBranch?.name || 'Main Branch'}
                </span>
                <span className="text-[10px] text-lime-400 font-bold bg-lime-400/10 px-1.5 py-0.5 rounded ml-auto">
                  {currentBranch?.code || 'MAIN'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowPricingModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-zinc-200 font-bold text-xs rounded-xl hover:bg-zinc-700 transition whitespace-nowrap"
          >
            <IconSettings className="w-3.5 h-3.5" /> Locker Pricing
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(163,230,53,0.3)] transition whitespace-nowrap"
          >
            <IconPlus className="w-3.5 h-3.5" /> Register Locker
          </button>
        </div>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`flex items-center gap-2.5 p-4 rounded-xl text-xs font-medium border ${
          message.type === 'success'
            ? 'bg-emerald-500/[0.06] text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/[0.06] text-red-400 border-red-500/20'
        }`}>
          {message.type === 'success' ? <IconCheck className="w-4 h-4 shrink-0" /> : <IconAlert className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {unconfiguredCount > 0 && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl text-xs font-medium border bg-amber-500/[0.06] text-amber-400 border-amber-500/20">
          <IconAlert className="w-4 h-4 shrink-0" />
          {unconfiguredCount} locker{unconfiguredCount > 1 ? 's' : ''} mein pricing configure nahi hai — pehle "Locker Pricing" se default set karein.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 font-medium">Total Registered</p>
            <IconLocker className="w-4 h-4 text-zinc-500" />
          </div>
          <p className="text-3xl font-bold text-white mt-2 font-mono">{totalCount}</p>
        </div>

        <div className="relative overflow-hidden bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-400 font-medium">Available Units</p>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_1px] shadow-emerald-400/70" />
          </div>
          <p className="text-3xl font-bold text-emerald-400 mt-2 font-mono">{availableCount}</p>
        </div>

        <div className="relative overflow-hidden bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-amber-400 font-medium">Occupied Units ({occupancyPct}%)</p>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_1px] shadow-amber-400/70" />
          </div>
          <p className="text-3xl font-bold text-amber-400 mt-2 font-mono">{occupiedCount}</p>
        </div>
      </div>

      {/* View Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab('grid')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              viewTab === 'grid'
                ? 'bg-lime-400 text-zinc-950 shadow-sm'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            🔲 Visual Locker Grid ({filteredLockers.length})
          </button>
          <button
            onClick={() => setViewTab('table')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              viewTab === 'table'
                ? 'bg-lime-400 text-zinc-950 shadow-sm'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            📋 Active Allotments Table ({occupiedLockersList.length})
          </button>
        </div>

        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by Locker # or Member Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition"
          />
        </div>
      </div>

      {/* ─── TAB 1: VISUAL LOCKER GRID ─── */}
      {viewTab === 'grid' && (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h3 className="text-sm font-bold text-white tracking-tight">
              {currentBranch?.name || 'Main Branch'} <span className="text-zinc-500 font-normal">· Real-Time Occupancy & Status Board</span>
            </h3>
            <div className="flex items-center gap-4 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Occupied</span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500 text-sm">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-lime-400 rounded-full animate-spin" />
              Loading lockers...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredLockers.map((l) => {
                const isOccupied = l.status === 'occupied';
                const remaining = isOccupied ? getRemainingDaysInfo(l.end_date) : null;

                return (
                  <div
                    key={l.id}
                    className={`relative p-4 rounded-2xl border flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 ${
                      isOccupied
                        ? 'bg-zinc-950 border-amber-500/30 hover:border-amber-400/60 shadow-[0_4px_20px_rgba(245,158,11,0.05)]'
                        : 'bg-zinc-950 border-emerald-500/20 hover:border-emerald-400/50 shadow-[0_4px_20px_rgba(16,185,129,0.05)]'
                    }`}
                  >
                    <span
                      className={`absolute top-3.5 right-3.5 w-2 h-2 rounded-full ${
                        isOccupied ? 'bg-amber-400 shadow-[0_0_8px_1px] shadow-amber-400/80' : 'bg-emerald-400 shadow-[0_0_8px_1px] shadow-emerald-400/80'
                      }`}
                    />

                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Locker</span>
                        <h4 className="text-xl font-black text-white font-mono">#{l.locker_number}</h4>
                      </div>

                      <div className="mt-1 text-[11px] text-zinc-400 flex items-center justify-between">
                        <span>Rent: <strong className="text-zinc-200">{formatCurrency(isOccupied ? l.charged_monthly_rent : l.effective_monthly_rent)}</strong>/mo</span>
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                          isOccupied ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                        }`}>
                          {l.status}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="mt-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-white font-bold truncate">
                            <IconUser className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                            <span className="truncate">{l.first_name} {l.last_name || ''}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono flex justify-between">
                            <span>ID: <strong className="text-zinc-300">{l.member_code}</strong></span>
                            {l.invoice_number && <span className="text-lime-400 font-bold">{l.invoice_number}</span>}
                          </div>
                          <div className="flex justify-between items-center text-[10.5px] pt-1.5 border-t border-zinc-800/80 mt-1">
                            <span className="text-zinc-500">Till: {l.end_date ? new Date(l.end_date).toLocaleDateString('en-IN') : 'Ongoing'}</span>
                            <span className={`font-bold font-mono text-[10px] ${
                              remaining.isExpired ? 'text-red-400' : remaining.isWarning ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {remaining.text}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 rounded-xl bg-zinc-900/40 border border-dashed border-zinc-800/80 text-center text-[11px] text-zinc-500">
                          Deposit: {formatCurrency(l.effective_security_deposit)}<br />
                          Ready for member invoice
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-900">
                      {isOccupied ? (
                        <button
                          onClick={() => handleVacate(l.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-900 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 border border-zinc-800 hover:border-red-500/40 rounded-xl text-xs font-semibold transition"
                        >
                          <IconUnlock className="w-3.5 h-3.5" /> Vacate Locker
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBookViaBilling(l)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 rounded-xl text-xs font-bold transition shadow-[0_0_10px_rgba(163,230,53,0.2)]"
                        >
                          <IconRupee className="w-3.5 h-3.5" /> Book via Invoice
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredLockers.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
                  <IconLocker className="w-8 h-8 text-zinc-700" />
                  Koi locker record nahi mila.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: DETAILED ALLOTMENT AUDIT TABLE ─── */}
      {viewTab === 'table' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/60">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              📜 Occupied Lockers Directory & Rental Expiry Audit
            </h3>
            <span className="text-xs font-semibold bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full font-mono">
              {occupiedLockersList.length} Active Allotments
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold border-b border-zinc-800 tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-mono">Locker #</th>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Member Code</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Allocation Period</th>
                  <th className="py-3 px-4 text-center">Remaining Status</th>
                  <th className="py-3 px-4 text-right">Rent / Mo</th>
                  <th className="py-3 px-4 text-right">Security Deposit</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {occupiedLockersList.map((l) => {
                  const remaining = getRemainingDaysInfo(l.end_date);
                  return (
                    <tr key={l.id} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 font-mono text-lime-400 font-bold text-sm">
                        #{l.locker_number}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {l.first_name} {l.last_name || ''}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {l.member_code}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-lime-400">
                        {l.invoice_number || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-zinc-200">{l.start_date ? new Date(l.start_date).toLocaleDateString('en-IN') : '—'}</span>
                        <span className="text-zinc-500 mx-1.5">to</span>
                        <span className="text-zinc-200 font-semibold">{l.end_date ? new Date(l.end_date).toLocaleDateString('en-IN') : 'Ongoing'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                          remaining.isExpired
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : remaining.isWarning
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {remaining.text}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-200">
                        {formatCurrency(l.charged_monthly_rent)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400 font-semibold">
                        {formatCurrency(l.charged_security_deposit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleVacate(l.id)}
                          className="px-3 py-1 bg-zinc-800 hover:bg-red-500/20 text-red-400 border border-zinc-700 hover:border-red-500/30 rounded-lg text-xs font-semibold transition"
                        >
                          Vacate ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {occupiedLockersList.length === 0 && (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-zinc-500">
                      Abhi koi locker kisi member ko occupied/assigned nahi hai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Register Locker Unit */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-lime-400/10 flex items-center justify-center text-lime-400">
                  <IconLocker className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-base font-bold text-white">Register New Locker</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition">
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLocker} className="space-y-4">
              <div>
                <label className={labelCls}>Branch Location (Auto)</label>
                <div className={fieldWrapCls}>
                  <IconBuilding className={fieldIconCls} />
                  <input
                    type="text"
                    disabled
                    value={currentBranch ? `${currentBranch.name} (${currentBranch.code || 'MAIN'})` : 'Main Branch'}
                    className={readOnlyInputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Locker Number / Code *</label>
                <div className={fieldWrapCls}>
                  <IconLocker className={fieldIconCls} />
                  <input type="text" required placeholder="e.g. 101 or L-12" value={lockerNumber} onChange={(e) => setLockerNumber(e.target.value)} className={inputCls} />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Ye locker branch ki default pricing ({formatCurrency(branchPricingForm.default_monthly_rent)}/mo,
                {' '}{formatCurrency(branchPricingForm.default_security_deposit)} deposit) automatically inherit karega.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-bold bg-lime-400 hover:bg-lime-300 text-zinc-950 disabled:opacity-60 transition shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                  {submitting ? 'Registering...' : 'Save Locker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Branch Locker Pricing */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-lime-400/10 flex items-center justify-center text-lime-400">
                  <IconSettings className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Locker Pricing — {currentBranch?.name || 'Main Branch'}</h3>
                  <p className="text-xs text-zinc-500">Default rental aur security deposit settings</p>
                </div>
              </div>
              <button onClick={() => setShowPricingModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition">
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-4">
              <div>
                <label className={labelCls}>Default Monthly Rent (₹)</label>
                <div className={fieldWrapCls}>
                  <IconRupee className={fieldIconCls} />
                  <input
                    type="number" step="0.01" min="0" required
                    value={branchPricingForm.default_monthly_rent}
                    onChange={(e) => setBranchPricingForm({ ...branchPricingForm, default_monthly_rent: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Default Security Deposit (₹)</label>
                <div className={fieldWrapCls}>
                  <IconRupee className={fieldIconCls} />
                  <input
                    type="number" step="0.01" min="0" required
                    value={branchPricingForm.default_security_deposit}
                    onChange={(e) => setBranchPricingForm({ ...branchPricingForm, default_security_deposit: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPricingModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-bold bg-lime-400 hover:bg-lime-300 text-zinc-950 disabled:opacity-60 transition shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                  {submitting ? 'Saving...' : 'Save Pricing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}