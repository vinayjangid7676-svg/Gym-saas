import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api';
import { useBranch } from '../context/BranchContext';

export default function Plans() {
  const { activeBranch } = useBranch();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Status popup state for professional success/error feedback
  const [popup, setPopup] = useState({
    show: false,
    title: '',
    message: '',
    planName: ''
  });

  const initialForm = {
    name: '',
    duration_days: '',
    session_count: '',
    base_price: '',
    tax_percentage: '18.00',
    allow_freezes: false,
    max_freeze_days: '0',
    all_branches: true
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/v1/plans');
      if (res?.success) {
        setPlans(res.data || []);
      } else {
        console.error(res?.message || 'Failed to fetch plans');
      }
    } catch (err) {
      console.error('Plan loading exception:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();

    // Listen to global branch switch event
    const handleBranchChange = () => fetchPlans();
    window.addEventListener('branchChanged', handleBranchChange);

    return () => {
      window.removeEventListener('branchChanged', handleBranchChange);
    };
  }, [fetchPlans, activeBranch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name || !formData.duration_days || !formData.base_price) {
      setErrorMsg('Plan Name, Duration Days aur Base Price zaroori hain.');
      return;
    }

    setSubmitting(true);
    const createdPlanName = formData.name;
    const payload = {
      name: formData.name,
      duration_days: Number(formData.duration_days),
      base_price: Number(formData.base_price),
      tax_percentage: Number(formData.tax_percentage || 0),
      session_count: formData.session_count ? Number(formData.session_count) : null,
      allow_freezes: formData.allow_freezes,
      max_freeze_days: formData.allow_freezes ? Number(formData.max_freeze_days || 0) : 0,
      branch_id: formData.all_branches ? null : activeBranch?.id
    };

    const res = await apiPost('/api/v1/plans', payload);
    setSubmitting(false);

    if (res?.success) {
      setShowModal(false);
      setFormData(initialForm);
      fetchPlans();

      // Show professional animated success modal
      setPopup({
        show: true,
        title: 'Plan Successfully Created!',
        message: 'Membership package active ho chuka hai aur checkout ke liye available hai.',
        planName: createdPlanName
      });

      // Auto dismiss popup after 2.4 seconds
      setTimeout(() => {
        setPopup((prev) => ({ ...prev, show: false }));
      }, 2400);
    } else {
      setErrorMsg(res?.message || res?.error || 'Plan create karne me dikkat aayi.');
    }
  };

  const closePopup = () => {
    setPopup((prev) => ({ ...prev, show: false }));
  };

  return (
    <div className="relative space-y-6">
      {/* Keyframe animations for checkmark and modal entry */}
      <style>{`
        @keyframes strokeAnimation {
          0% { stroke-dashoffset: 48; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-draw-check {
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: strokeAnimation 0.5s cubic-bezier(0.65, 0, 0.45, 1) 0.15s forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* SUCCESS CONFIRMATION MODAL */}
      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-sm rounded-2xl border border-lime-500/30 bg-zinc-900 p-6 text-center shadow-2xl shadow-lime-500/10 animate-scale-in">
            <div className="flex flex-col items-center">
              {/* Outer Glow Ring & Animated Checkmark */}
              <div className="relative flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-lime-400/10 border border-lime-400/30">
                <div className="absolute inset-0 rounded-full bg-lime-400/20 blur-xl animate-pulse" />
                <svg
                  className="w-10 h-10 text-lime-400 relative z-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight">{popup.title}</h3>

              {popup.planName && (
                <div className="mt-2 px-3 py-1 bg-zinc-800/80 rounded-lg border border-zinc-700/60 text-xs font-semibold text-lime-300">
                  "{popup.planName}"
                </div>
              )}

              <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-[260px]">
                {popup.message}
              </p>

              <button
                type="button"
                onClick={closePopup}
                className="mt-6 w-full py-2.5 px-4 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs transition shadow-lg shadow-lime-400/10"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header & Context Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Membership Plans</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
              Branch: {activeBranch ? activeBranch.name : 'All Gym Branches'}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Apne gym aur branches ke liye tier-based membership packages manage karein.
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg('');
            setShowModal(true);
          }}
          className="px-5 py-2.5 bg-lime-400 text-zinc-950 font-bold text-sm rounded-xl hover:bg-lime-300 transition shadow-sm hover:shadow-lime-400/10"
        >
          + Create New Plan
        </button>
      </div>

      {/* Plans Grid Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
          <div className="w-8 h-8 border-3 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Active packages load ho rahe hain...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-zinc-300 font-medium text-base">Koi Plan Nahi Mila</p>
          <p className="text-xs text-zinc-500 mt-1.5">
            Is branch ke liye naya membership package create karne ke liye upar button par click karein.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const base = Number(plan.base_price);
            const taxPct = Number(plan.tax_percentage || 0);
            const totalPrice = base + (base * taxPct) / 100;

            return (
              <div
                key={plan.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-700 transition"
              >
                <div>
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">{plan.name}</h3>
                    <span className="text-xs px-2.5 py-1 bg-lime-400/10 text-lime-400 border border-lime-400/20 rounded-full font-semibold shrink-0">
                      {plan.duration_days} Days
                    </span>
                  </div>

                  <div className="mb-2">
                    <span className="text-xs text-zinc-400 font-medium">
                      {plan.branch_id ? `📍 ${plan.branch_name || 'Branch Exclusive'}` : '🌐 Valid All Branches'}
                    </span>
                  </div>

                  <div className="my-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">₹{base.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-zinc-400 font-normal">/ package</span>
                    </div>
                    {taxPct > 0 && (
                      <p className="text-[11px] text-zinc-400 mt-1">
                        +{taxPct}% GST incl. total: ₹{Math.round(totalPrice).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2.5 text-xs text-zinc-400 border-t border-zinc-800/80 pt-4">
                    <div className="flex justify-between">
                      <span>Sessions Limit:</span>
                      <span className="text-zinc-200 font-medium">
                        {plan.session_count ? `${plan.session_count} Sessions` : 'Unlimited Access'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Membership Freeze:</span>
                      <span className="text-zinc-200 font-medium">
                        {plan.allow_freezes ? `Allowed (${plan.max_freeze_days} Days)` : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/50 flex justify-between items-center">
                  <span className="text-[11px] text-zinc-500 font-mono">ID: {plan.hash_id || plan.id}</span>
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                    Active
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PLAN MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl p-6 relative max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white">Naya Membership Plan Banao</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-lg transition"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Plan Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3 Months Transformation Gold"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-medium">Duration (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 90"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-medium">Base Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 4500"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-medium">Tax Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="18"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                    value={formData.tax_percentage}
                    onChange={(e) => setFormData({ ...formData, tax_percentage: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-medium">Session Count (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited ke liye khali chhodein"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                    value={formData.session_count}
                    onChange={(e) => setFormData({ ...formData, session_count: e.target.value })}
                  />
                </div>
              </div>

              {/* Multi-Branch Scope Selection */}
              <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-zinc-700 text-lime-400 focus:ring-0 bg-zinc-900"
                    checked={formData.all_branches}
                    onChange={(e) => setFormData({ ...formData, all_branches: e.target.checked })}
                  />
                  <span className="text-xs text-zinc-200 font-medium">Saari Branches ke liye apply karein</span>
                </label>
                {!formData.all_branches && activeBranch && (
                  <p className="text-[11px] text-zinc-500 pl-6.5">
                    Ye plan sirf <strong className="text-zinc-300">"{activeBranch.name}"</strong> branch me dikhega.
                  </p>
                )}
              </div>

              {/* Freeze Configuration */}
              <div className="pt-2 border-t border-zinc-800 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-zinc-700 text-lime-400 focus:ring-0 bg-zinc-900"
                    checked={formData.allow_freezes}
                    onChange={(e) => setFormData({ ...formData, allow_freezes: e.target.checked })}
                  />
                  <span className="text-xs text-zinc-300 font-medium">Membership Freeze Allowed</span>
                </label>

                {formData.allow_freezes && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-medium">Max Allowed Freeze Days</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 15"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400 transition"
                      value={formData.max_freeze_days}
                      onChange={(e) => setFormData({ ...formData, max_freeze_days: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-semibold hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-lime-400 text-zinc-950 font-bold text-xs rounded-xl hover:bg-lime-300 transition disabled:opacity-50"
                >
                  {submitting ? 'Creating Package...' : 'Publish Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}