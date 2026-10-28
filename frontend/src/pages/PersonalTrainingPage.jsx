import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '../api';

const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition';
const labelCls = 'text-xs text-zinc-400 block mb-1 font-semibold uppercase tracking-wider';

export default function PersonalTrainingPage() {
  let currentUser = null;
  try {
    const raw = localStorage.getItem('gym_user');
    if (raw) currentUser = JSON.parse(raw);
  } catch (e) {
    currentUser = null;
  }

  const currentRole = (currentUser?.role || currentUser?.role_slug || 'trainer').toLowerCase().trim();
  const isSuper = Boolean(currentUser?.isSuperAdmin || currentUser?.is_super_admin);
  const isManagement = isSuper || currentRole === 'owner' || currentRole === 'manager';
  const isReception = currentRole === 'receptionist';

  const [activeTab, setActiveTab] = useState('clients'); // 'clients' | 'packages'
  const [enrollments, setEnrollments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Forms
  const [planForm, setPlanForm] = useState({
    name: '',
    session_count: 12,
    price: '',
    validity_days: 30
  });

  const [enrollForm, setEnrollForm] = useState({
    member_id: '',
    trainer_id: '',
    plan_id: '',
    start_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [punchForm, setPunchForm] = useState({
    scheduled_start: new Date().toISOString().slice(0, 16),
    duration_minutes: 60,
    trainer_rating: 5,
    notes: 'Compound workout + Core routine completed',
    status: 'completed'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [apiGet('/api/v1/pt/enrollments')];

      if (isManagement || isReception) {
        promises.push(apiGet('/api/v1/pt/plans').catch(() => ({ success: false })));
        promises.push(apiGet('/api/v1/staff').catch(() => ({ success: false })));
        promises.push(apiGet('/api/v1/members?limit=1000').catch(() => ({ success: false })));
      }

      const [enrRes, plansRes, staffRes, memRes] = await Promise.all(promises);

      if (enrRes?.success) setEnrollments(enrRes.data || []);
      if (plansRes?.success) setPlans(plansRes.data || []);
      if (staffRes?.success) setTrainers(staffRes.data || []);
      if (memRes?.success) setMembers(memRes.data || []);
    } catch (err) {
      console.error('PT Load Error:', err);
    } finally {
      setLoading(false);
    }
  }, [isManagement, isReception]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Past Punch History for a Member
  const handleOpenHistory = async (enr) => {
    setSelectedEnrollment(enr);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await apiGet(`/api/v1/pt/enrollments/${enr.id}/sessions`);
      if (res?.success) setSessionHistory(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Create PT Plan
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiPost('/api/v1/pt/plans', {
      name: planForm.name,
      session_count: parseInt(planForm.session_count, 10),
      price: parseFloat(planForm.price),
      validity_days: parseInt(planForm.validity_days, 10)
    });

    if (res?.success) {
      setMessage({ type: 'success', text: 'Naya PT Plan Package successfully create ho gaya!' });
      setShowPlanModal(false);
      setPlanForm({ name: '', session_count: 12, price: '', validity_days: 30 });
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Plan save nahi ho saka.' });
    }
    setSubmitting(false);
  };

  // Enroll Member into PT
  const handleEnrollMember = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiPost('/api/v1/pt/enroll', {
      member_id: parseInt(enrollForm.member_id, 10),
      trainer_id: parseInt(enrollForm.trainer_id, 10),
      plan_id: parseInt(enrollForm.plan_id, 10),
      start_date: enrollForm.start_date,
      notes: enrollForm.notes || null
    });

    if (res?.success) {
      setMessage({ type: 'success', text: 'Member successfully PT package me enroll ho gaya!' });
      setShowEnrollModal(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Enrollment failed.' });
    }
    setSubmitting(false);
  };

  // 1-Click Punch / Log Session
  const handlePunchSession = async (e) => {
    e.preventDefault();
    if (!selectedEnrollment) return;

    setSubmitting(true);
    const res = await apiPost('/api/v1/pt/sessions', {
      enrollment_id: selectedEnrollment.id,
      scheduled_start: punchForm.scheduled_start,
      duration_minutes: parseInt(punchForm.duration_minutes, 10),
      trainer_rating: parseInt(punchForm.trainer_rating, 10),
      status: punchForm.status,
      notes: punchForm.notes
    });

    if (res?.success) {
      setMessage({
        type: 'success',
        text: `Session punched! Bachi hui sessions: ${res.data?.sessions_remaining}`
      });
      setShowPunchModal(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Session punch fail ho gaya.' });
    }
    setSubmitting(false);
  };

  // Filtered Client List
  const filteredEnrollments = useMemo(() => {
    if (!searchQuery.trim()) return enrollments;
    const q = searchQuery.toLowerCase();
    return enrollments.filter(
      (enr) =>
        enr.member_name?.toLowerCase().includes(q) ||
        enr.member_code?.toLowerCase().includes(q) ||
        enr.trainer_name?.toLowerCase().includes(q) ||
        enr.plan_name?.toLowerCase().includes(q)
    );
  }, [enrollments, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 rounded-3xl shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Personal Training (PT) Desk</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-lime-400/10 text-lime-400 border border-lime-400/30">
              {currentRole} Access
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            {currentRole === 'trainer'
              ? 'Aapke assigned PT clients, digital attendance meter, aur session audit ledger.'
              : 'Real-time trainer slot metering, automated session punch cards, aur client renewals.'}
          </p>
        </div>

        {(isManagement || isReception) && (
          <div className="flex flex-wrap gap-2.5">
            {isManagement && (
              <button
                onClick={() => setShowPlanModal(true)}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold rounded-xl transition"
              >
                + Create PT Package
              </button>
            )}
            <button
              onClick={() => setShowEnrollModal(true)}
              className="px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.3)]"
            >
              🎯 Assign Trainer To Member
            </button>
          </div>
        )}
      </div>

      {/* Alert Banner */}
      {message.text && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border flex justify-between items-center ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          <span>{message.type === 'success' ? '✓ ' : '⚠ '}{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="hover:text-white">✕</button>
        </div>
      )}

      {/* Tab Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'clients' ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
            }`}
          >
            🏋️ {currentRole === 'trainer' ? 'My Assigned PT Clients' : 'Active PT Clients'} ({enrollments.length})
          </button>

          {isManagement && (
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                activeTab === 'packages' ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
              }`}
            >
              📦 PT Packages & Pricing ({plans.length})
            </button>
          )}
        </div>

        {activeTab === 'clients' && (
          <div className="w-full sm:w-80">
            <input
              type="text"
              placeholder="Search member, code, ya trainer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-3xl text-xs">
          Loading Personal Training Records...
        </div>
      ) : activeTab === 'clients' ? (
        /* Active PT Clients Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEnrollments.map((enr) => {
            const used = parseInt(enr.sessions_used, 10);
            const total = parseInt(enr.sessions_total, 10);
            const remaining = total - used;
            const percent = Math.min(100, Math.round((used / total) * 100));
            const isExhausted = remaining <= 0;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const end = new Date(enr.end_date);
            end.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            const isExpired = daysLeft < 0;

            return (
              <div
                key={enr.id}
                className={`bg-zinc-900 border ${
                  isExhausted ? 'border-zinc-800' : daysLeft <= 5 ? 'border-amber-500/40' : 'border-zinc-800'
                } rounded-3xl p-5 space-y-4 flex flex-col justify-between shadow-xl hover:border-zinc-700 transition`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-lime-400">
                        {enr.plan_name}
                      </span>
                      <h4 className="text-lg font-bold text-white mt-0.5">{enr.member_name}</h4>
                      <p className="text-xs text-zinc-500 font-mono">{enr.member_code} • {enr.member_phone}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                          isExhausted
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {isExhausted ? 'Exhausted' : enr.status}
                      </span>
                      {enr.invoice_number && (
                        <span className="text-[9px] font-mono text-zinc-500">{enr.invoice_number}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Personal Trainer</span>
                      <strong className="text-white">{enr.trainer_name}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 block uppercase">Validity Status</span>
                      <strong className={isExpired ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-lime-400'}>
                        {isExpired ? 'Expired' : `${daysLeft}d left`}
                      </strong>
                    </div>
                  </div>

                  {/* Real-time Session Meter */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-400">Session Balance</span>
                      <span className={isExhausted ? 'text-red-400 font-bold' : 'text-zinc-200'}>
                        {used} / {total} ({remaining} Left)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isExhausted ? 'bg-red-500' : percent > 80 ? 'bg-amber-400' : 'bg-lime-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenHistory(enr)}
                    className="py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
                  >
                    📜 Punch History
                  </button>
                  <button
                    disabled={isExhausted}
                    onClick={() => {
                      setSelectedEnrollment(enr);
                      setShowPunchModal(true);
                    }}
                    className="py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition flex justify-center items-center gap-1.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 disabled:opacity-40 disabled:hover:bg-lime-400 shadow-sm"
                  >
                    {isExhausted ? 'Completed' : '⏱️ Punch (-1)'}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredEnrollments.length === 0 && (
            <div className="col-span-full py-20 text-center text-zinc-500 bg-zinc-900 border border-dashed border-zinc-800 rounded-3xl text-xs space-y-2">
              <span className="text-3xl block">🎯</span>
              <p className="font-semibold text-zinc-300">Koi active PT enrollment nahi mila.</p>
            </div>
          )}
        </div>
      ) : (
        /* PT Packages Catalog (Only Management) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-lime-400 uppercase font-mono font-bold">Standard PT Pack</span>
                <h4 className="text-lg font-bold text-white mt-0.5">{p.name}</h4>
                <p className="text-2xl font-bold font-mono text-white mt-2">₹{parseFloat(p.price).toFixed(2)}</p>
              </div>

              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Sessions:</span>
                  <strong className="text-white">{p.session_count} Slots</strong>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Validity:</span>
                  <strong className="text-lime-400">{p.validity_days || 30} Days</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL 1: CREATE PT PACKAGE ─── */}
      {showPlanModal && isManagement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create New PT Package</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className={labelCls}>Package Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hypertrophy Master (12 Sessions)"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Session Count *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={planForm.session_count}
                    onChange={(e) => setPlanForm({ ...planForm, session_count: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="8000.00"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Validity (Days)</label>
                <input
                  type="number"
                  min="7"
                  value={planForm.validity_days}
                  onChange={(e) => setPlanForm({ ...planForm, validity_days: e.target.value })}
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2"
              >
                {submitting ? 'Saving...' : 'Publish PT Plan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ASSIGN TRAINER TO MEMBER ─── */}
      {showEnrollModal && (isManagement || isReception) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Assign Trainer To Member</h3>
              <button onClick={() => setShowEnrollModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleEnrollMember} className="space-y-3">
              <div>
                <label className={labelCls}>Select Member *</label>
                <select
                  required
                  value={enrollForm.member_id}
                  onChange={(e) => setEnrollForm({ ...enrollForm, member_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.member_code} — {m.first_name} {m.last_name || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Assign Personal Trainer *</label>
                <select
                  required
                  value={enrollForm.trainer_id}
                  onChange={(e) => setEnrollForm({ ...enrollForm, trainer_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Select Trainer --</option>
                  {trainers.map((t) => (
                    <option key={t.id || t.user_id} value={t.id || t.user_id}>
                      {t.name || t.employee_code} ({t.designation || 'Coach'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>PT Package *</label>
                <select
                  required
                  value={enrollForm.plan_id}
                  onChange={(e) => setEnrollForm({ ...enrollForm, plan_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Select PT Package --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.session_count} Sessions • ₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Start Date *</label>
                <input
                  type="date"
                  required
                  value={enrollForm.start_date}
                  onChange={(e) => setEnrollForm({ ...enrollForm, start_date: e.target.value })}
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2"
              >
                {submitting ? 'Enrolling...' : 'Confirm Enrollment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: PUNCH / LOG DAILY SESSION ─── */}
      {showPunchModal && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Punch Workout Session</h3>
                <p className="text-xs text-lime-400 font-mono mt-0.5">{selectedEnrollment.member_name} with {selectedEnrollment.trainer_name}</p>
              </div>
              <button onClick={() => setShowPunchModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handlePunchSession} className="space-y-3">
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs flex justify-between font-mono">
                <span className="text-zinc-400">Current Balance:</span>
                <strong className="text-white">{selectedEnrollment.sessions_used} / {selectedEnrollment.sessions_total} used</strong>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Session Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={punchForm.scheduled_start}
                    onChange={(e) => setPunchForm({ ...punchForm, scheduled_start: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    required
                    value={punchForm.duration_minutes}
                    onChange={(e) => setPunchForm({ ...punchForm, duration_minutes: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Workout Notes / Exercises Performed</label>
                <textarea
                  rows="2"
                  value={punchForm.notes}
                  onChange={(e) => setPunchForm({ ...punchForm, notes: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Back & Biceps progressive overload completed."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
              >
                {submitting ? 'Punching...' : 'Punch & Deduct Session (-1)'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: SESSION AUDIT LEDGER DRAWER ─── */}
      {showHistoryModal && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">PT Punch History & Audit</h3>
                  <p className="text-xs text-lime-400 font-mono mt-0.5">{selectedEnrollment.member_name} ({selectedEnrollment.member_code})</p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>

              <div className="overflow-y-auto mt-4 space-y-2.5 max-h-[50vh] pr-1">
                {historyLoading ? (
                  <p className="text-xs text-zinc-500 text-center py-8">Loading history...</p>
                ) : sessionHistory.length > 0 ? (
                  sessionHistory.map((s, idx) => (
                    <div key={s.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-1 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-lime-400 font-bold">Session #{sessionHistory.length - idx}</span>
                        <span className="text-zinc-400 text-[11px]">{new Date(s.actual_start || s.scheduled_start).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-zinc-300 font-sans text-[11px]">{s.notes || 'Workout completed'}</p>
                      <div className="text-[10px] text-zinc-500 flex justify-between pt-1 border-t border-zinc-900">
                        <span>Duration: {s.duration_minutes || 60} mins</span>
                        <span className="text-emerald-400 uppercase">{s.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-8">Abhi tak koi session punch nahi hua hai.</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition"
            >
              Close History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}