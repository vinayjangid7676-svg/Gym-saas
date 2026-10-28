import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

/* ------------------------------------------------------------------ */
/*  Small inline icon set (no external icon package required)          */
/* ------------------------------------------------------------------ */
const Icon = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);
const IconSparkle = (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Icon>;
const IconTag = (p) => <Icon {...p}><path d="M12.5 3.5H6a2 2 0 0 0-2 2v6.5a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l6.5-6.5a2 2 0 0 0 0-2.8l-8-8a2 2 0 0 0-1.4-.6Z" /><circle cx="8.2" cy="8.2" r="1.2" /></Icon>;
const IconRupee = (p) => <Icon {...p}><path d="M7 5h10M7 5c5 0 7 1.6 7 4.2S12 13.4 7 13.4M7 9.5h10M7 13.4 15 20" /></Icon>;
const IconClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></Icon>;
const IconNote = (p) => <Icon {...p}><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M9 10h6M9 14h6M9 18h3" /></Icon>;
const IconAlert = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.2v.1" /></Icon>;
const IconBox = (p) => <Icon {...p}><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></Icon>;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
const IconShield = (p) => <Icon {...p}><path d="M12 3 4.5 6v5.5c0 4.5 3 8.2 7.5 9.5 4.5-1.3 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9.5 12 1.8 1.8 3.5-3.6" /></Icon>;
const IconChart = (p) => <Icon {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>;

/* ------------------------------------------------------------------ */
/*  Shared style tokens (Premium Edition)                              */
/* ------------------------------------------------------------------ */
const fieldWrapCls = 'relative group';
const fieldIconCls = 'absolute left-3 top-3 w-4 h-4 text-zinc-600 pointer-events-none group-focus-within:text-amber-400 transition-colors';
const inputCls =
  'w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 focus:outline-none transition-colors';
const labelCls = 'text-[11px] text-zinc-500 block mb-1.5 font-semibold tracking-wider uppercase';

export default function AddonsManagement() {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Addon Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration_days: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchAddons();
  }, []);

  const fetchAddons = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/v1/memberships/lifecycle/addons');
      if (res.success) {
        setAddons(res.addons || res.data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAddon = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    try {
     const res = await apiPost('/api/v1/memberships/lifecycle/addons/create', {
  name: formData.name,
  description: formData.description,
  price: parseFloat(formData.price),
  duration_days: formData.duration_days ? parseInt(formData.duration_days, 10) : null
});

      if (res.success) {
        setFormData({ name: '', description: '', price: '', duration_days: '' });
        fetchAddons();
      } else {
        setError(res.message || 'Add-on create karne me problem aayi.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Derived Stats (UI only)
  const totalAddons = addons.length;
  const avgPrice = totalAddons > 0
    ? (addons.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0) / totalAddons).toFixed(0)
    : 0;
  const durationBased = addons.filter(a => a.duration_days).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ═══════════════════ HEADER HERO ═══════════════════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-lime-400/5 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-lime-500 flex items-center justify-center text-zinc-950 shadow-[0_0_30px_-5px] shadow-lime-400/60 shrink-0">
            <IconSparkle className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-lime-400">Revenue Upsell Center</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Gym Add-ons Catalog
            </h2>
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed max-w-2xl">
              Extra services create karein jo members apni membership ke saath le sakte hain — locker, steam bath, PT sessions & more.
            </p>
          </div>

          {/* Live Stats Badges */}
          {!loading && totalAddons > 0 && (
            <div className="flex sm:flex-col gap-3 shrink-0">
              <div className="px-4 py-2.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-center min-w-[90px]">
                <span className="text-[9px] text-zinc-600 block uppercase tracking-widest font-bold">Total</span>
                <strong className="text-lime-400 font-mono text-lg">{totalAddons}</strong>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-center min-w-[90px]">
                <span className="text-[9px] text-zinc-600 block uppercase tracking-widest font-bold">Avg Price</span>
                <strong className="text-lime-400 font-mono text-lg flex items-center justify-center gap-0.5">
                  <IconRupee className="w-3.5 h-3.5" />{avgPrice}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ═══════════════ CREATE NEW ADD-ON FORM ═══════════════ */}
        <div className="relative bg-zinc-900/60 backdrop-blur border border-zinc-800 rounded-3xl p-6 h-fit shadow-xl hover:border-zinc-700/80 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-400/20 to-lime-400/5 border border-lime-400/25 flex items-center justify-center text-lime-400">
              <IconBox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">Create New Add-on</h3>
              <p className="text-[11px] text-zinc-500">Naya premium service entry karein</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 p-4 bg-red-500/[0.07] border border-red-500/25 rounded-2xl text-xs font-semibold text-red-400 animate-in slide-in-from-top-2 duration-300">
              <IconAlert className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleCreateAddon} className="space-y-5">
            <div>
              <label className={labelCls}>Add-on Name</label>
              <div className={fieldWrapCls}>
                <IconTag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none group-focus-within:text-amber-400 transition-colors" />
                <input
                  type="text"
                  required
                  placeholder="e.g., Steam Bath, Personal Locker"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Price (₹)</label>
              <div className={fieldWrapCls}>
                <IconRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none group-focus-within:text-amber-400 transition-colors" />
                <input
                  type="number"
                  required
                  placeholder="500"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Duration Days (Optional)</label>
              <div className={fieldWrapCls}>
                <IconClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none group-focus-within:text-amber-400 transition-colors" />
                <input
                  type="number"
                  placeholder="30 (blank for one-time service)"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                  className={inputCls}
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5 flex items-center gap-1">
                <IconShield className="w-3 h-3" /> Blank chhodein agar one-time service hai
              </p>
            </div>

            <div>
              <label className={labelCls}>Description (Optional)</label>
              <div className={fieldWrapCls}>
                <IconNote className={fieldIconCls} />
                <textarea
                  rows="3"
                  placeholder="Details about the add-on..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`${inputCls} pt-2.5 resize-none`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-b from-lime-400 to-lime-500 text-zinc-950 font-extrabold text-sm rounded-xl hover:brightness-105 active:brightness-95 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-[0_4px_20px_-4px] shadow-lime-400/50 hover:shadow-[0_6px_28px_-4px] shadow-lime-400/60"
            >
              {submitLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  Saving Add-on...
                </>
              ) : (
                <>
                  <IconPlus className="w-4 h-4" /> Save Add-on
                </>
              )}
            </button>
          </form>
        </div>

        {/* ═══════════════ EXISTING ADD-ONS TABLE ═══════════════ */}
        <div className="lg:col-span-2 bg-zinc-900/60 backdrop-blur border border-zinc-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6 pb-5 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-400/20 to-lime-400/5 border border-lime-400/25 flex items-center justify-center text-lime-400">
                <IconChart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white tracking-tight">Available Add-ons</h3>
                <p className="text-[11px] text-zinc-500">Catalog me publish saare services</p>
              </div>
            </div>
            {!loading && addons.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-950/70 border border-zinc-800 rounded-full px-3 py-1.5 tabular-nums">
                  <strong className="text-lime-400">{durationBased}</strong> duration-based
                </span>
                <span className="text-[11px] font-bold text-zinc-300 bg-amber-400/10 border border-amber-400/25 rounded-full px-3 py-1.5 tabular-nums">
                  {addons.length} total
                </span>
              </div>
            )}
          </div>

          {loading ? (
            /* Premium Skeleton Loader */
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800/50 animate-pulse">
                  <div className="h-10 w-10 rounded-xl bg-zinc-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-zinc-800" />
                    <div className="h-2.5 w-1/2 rounded bg-zinc-800/70" />
                  </div>
                  <div className="h-6 w-20 rounded-lg bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : addons.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-950/70 border border-zinc-800 grid place-items-center">
                <IconBox className="w-8 h-8 text-zinc-700" />
              </div>
              <p className="text-sm font-bold text-zinc-300">Abhi tak koi add-on create nahi hua</p>
              <p className="text-xs text-zinc-600 max-w-xs">Left panel se apna pehla add-on banayein — jaise Steam Bath, Personal Locker ya Diet Consultation.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-left text-sm text-zinc-300 border-separate border-spacing-0">
                <thead>
                  <tr className="text-[10px] text-zinc-600 uppercase tracking-widest">
                    <th className="py-3 px-4 font-bold border-b border-zinc-800">#</th>
                    <th className="py-3 px-4 font-bold border-b border-zinc-800">Add-on Service</th>
                    <th className="py-3 px-4 font-bold border-b border-zinc-800">Price</th>
                    <th className="py-3 px-4 font-bold border-b border-zinc-800">Validity</th>
                    <th className="py-3 px-4 font-bold border-b border-zinc-800">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((addon, idx) => (
                    <tr
                      key={addon.id}
                      className="group hover:bg-lime-400/[0.03] transition-colors duration-200"
                    >
                      <td className="py-4 px-4 border-b border-zinc-800/50">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-500 group-hover:text-lime-400 group-hover:border-lime-400/30 transition-colors">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="py-4 px-4 border-b border-zinc-800/50">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-lime-400/15 to-transparent border border-lime-400/20 grid place-items-center text-lime-400 shrink-0">
                            <IconTag className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-white group-hover:text-lime-300 transition-colors">{addon.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 border-b border-zinc-800/50">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-lime-400/10 text-lime-400 font-mono font-bold text-sm tabular-nums border border-lime-400/20">
                          <IconRupee className="w-3.5 h-3.5" />{addon.price}
                        </span>
                      </td>
                      <td className="py-4 px-4 border-b border-zinc-800/50">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold ${
                          addon.duration_days
                            ? 'bg-lime-400/10 text-lime-400 border border-lime    -400/25'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                        }`}>
                          <IconClock className="w-3 h-3" />
                          {addon.duration_days ? `${addon.duration_days} Days Validity` : 'One-time Session'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-zinc-500 border-b border-zinc-800/50 max-w-[220px]">
                        <span className="line-clamp-2 leading-relaxed">{addon.description || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer Summary */}
          {!loading && addons.length > 0 && (
            <div className="mt-5 pt-4 border-t border-zinc-800/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 font-mono">
              <span>Showing <strong className="text-zinc-300">{addons.length}</strong> add-ons in catalog</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {addons.filter(a => !a.duration_days).length} one-time ·
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400 ml-1.5" />
                {durationBased} duration-based
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}