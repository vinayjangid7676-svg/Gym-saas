import React, { useState, useEffect, useCallback } from 'react';
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
const IconGift = (p) => <Icon {...p}><rect x="3.5" y="8.5" width="17" height="11.5" rx="1.5" /><path d="M3.5 12.5h17" /><path d="M12 8.5v11.5" /><path d="M12 8.5c-1.8 0-3.2-1.2-3.2-2.8S9.4 3 11 3c1.4 0 2.4 1.3 3 3" /><path d="M12 8.5c1.8 0 3.2-1.2 3.2-2.8S14.6 3 13 3c-1.4 0-2.4 1.3-3 3" /></Icon>;
const IconTicket = (p) => <Icon {...p}><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" /><path d="M10 6v12" strokeDasharray="2 2.4" /></Icon>;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
const IconClose = (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
const IconCalendar = (p) => <Icon {...p}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></Icon>;
const IconTag = (p) => <Icon {...p}><path d="M12.5 3.5H6a2 2 0 0 0-2 2v6.5a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l6.5-6.5a2 2 0 0 0 0-2.8l-8-8a2 2 0 0 0-1.4-.6Z" /><circle cx="8.2" cy="8.2" r="1.2" /></Icon>;
const IconLayers = (p) => <Icon {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></Icon>;
const IconLink = (p) => <Icon {...p}><path d="M9.5 14.5 14.5 9.5" /><path d="M11 6.5 12.8 4.7a3.2 3.2 0 0 1 4.5 4.5L15.5 11" /><path d="M13 17.5 11.2 19.3a3.2 3.2 0 0 1-4.5-4.5L8.5 13" /></Icon>;

const inputCls = 'w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 focus:outline-none transition-colors';
const inputPlainCls = 'w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 focus:outline-none transition-colors';
const labelCls = 'text-[11px] text-zinc-500 block mb-1.5 font-medium tracking-wide';
const fieldWrapCls = 'relative';
const fieldIconCls = 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none';

export default function Promotions() {
  const [offers, setOffers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'offer' | 'coupon'
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [offerForm, setOfferForm] = useState({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    start_date: '',
    end_date: '',
    max_uses: ''
  });

  const [couponForm, setCouponForm] = useState({
    offer_id: '',
    code: '',
    max_uses: '',
    expires_at: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await apiGet('/api/v1/discounts/promotions');
    if (res?.success) {
      setOffers(res.data?.offers || []);
      setCoupons(res.data?.coupons || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiPost('/api/v1/discounts/offers', {
      ...offerForm,
      discount_value: parseFloat(offerForm.discount_value),
      max_uses: offerForm.max_uses ? parseInt(offerForm.max_uses, 10) : null
    });

    if (res?.success) {
      setOfferForm({ name: '', description: '', discount_type: 'percentage', discount_value: '', start_date: '', end_date: '', max_uses: '' });
      setActiveModal(null);
      fetchData();
    } else {
      alert(res?.message || 'Offer create nahi ho saka.');
    }
    setSubmitting(false);
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiPost('/api/v1/discounts/coupons', {
      ...couponForm,
      offer_id: couponForm.offer_id ? parseInt(couponForm.offer_id, 10) : null,
      max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses, 10) : null
    });

    if (res?.success) {
      setCouponForm({ offer_id: '', code: '', max_uses: '', expires_at: '' });
      setActiveModal(null);
      fetchData();
    } else {
      alert(res?.message || 'Coupon code create nahi ho saka.');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime-400 to-lime-400 flex items-center justify-center text-zinc-950 shadow-[0_0_24px_-6px] shadow-amber-400/60 shrink-0">
            <IconTag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Discounts &amp; Promo Engine</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Marketing campaigns, season offers aur coupon codes</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveModal('offer')}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-lime-400 text-xs font-bold rounded-xl border border-zinc-700 transition whitespace-nowrap"
          >
            <IconPlus className="w-3.5 h-3.5" /> Create Campaign Offer
          </button>
          <button
            onClick={() => setActiveModal('coupon')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-lime-400 to-lime-400 hover:brightness-105 text-zinc-950 text-xs font-bold rounded-xl transition whitespace-nowrap shadow-[0_4px_16px_-4px] shadow-lime-400"
          >
            <IconPlus className="w-3.5 h-3.5" /> Generate Coupon Code
          </button>
        </div>
      </div>

      {/* Grid: Campaigns & Coupons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Offers Column */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between tracking-tight">
            <span className="flex items-center gap-2"><IconGift className="w-4 h-4 text-lime-400" /> Active Campaign Offers</span>
            <span className="text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded-full tabular-nums">{offers.length}</span>
          </h3>

          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center gap-3 text-zinc-500 text-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-lime-400 rounded-full animate-spin" />
              Loading offers...
            </div>
          ) : offers.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center gap-2 text-zinc-500 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl text-sm">
              <IconGift className="w-6 h-6 text-zinc-700" />
              Koi offer campaign active nahi hai.
            </div>
          ) : (
            offers.map((o) => (
              <div key={o.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h4 className="font-bold text-white text-sm">{o.name}</h4>
                    {o.description && <p className="text-xs text-zinc-500 mt-0.5">{o.description}</p>}
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400/10 text-lime-400 border border-lime-400/20 whitespace-nowrap">
                    {o.discount_type === 'percentage' ? `${o.discount_value}% OFF` : `₹${o.discount_value} FLAT OFF`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-zinc-500 pt-3 border-t border-zinc-800/80">
                  <span className="flex items-center gap-1.5"><IconLayers className="w-3.5 h-3.5" /> Limit: {o.max_uses || 'Unlimited'}</span>
                  <span className="flex items-center gap-1.5">
                    <IconCalendar className="w-3.5 h-3.5" />
                    {o.start_date ? new Date(o.start_date).toLocaleDateString() : 'Immediate'} – {o.end_date ? new Date(o.end_date).toLocaleDateString() : 'Ongoing'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Coupon Codes Column */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between tracking-tight">
            <span className="flex items-center gap-2"><IconTicket className="w-4 h-4 text-lime-400" /> Redeemable Coupon Codes</span>
            <span className="text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded-full tabular-nums">{coupons.length}</span>
          </h3>

          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center gap-3 text-zinc-500 text-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-lime-400 rounded-full animate-spin" />
              Loading coupons...
            </div>
          ) : coupons.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center gap-2 text-zinc-500 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl text-sm">
              <IconTicket className="w-6 h-6 text-zinc-700" />
              Abhi tak koi specific coupon code generate nahi hua.
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300 border-separate border-spacing-0">
                  <thead className="text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5 font-semibold border-b border-zinc-800">Code</th>
                      <th className="p-3.5 font-semibold border-b border-zinc-800">Linked Campaign</th>
                      <th className="p-3.5 font-semibold border-b border-zinc-800">Usage</th>
                      <th className="p-3.5 font-semibold border-b border-zinc-800">Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="p-3.5 border-b border-zinc-800/60">
                          <span className="inline-flex items-center gap-1.5 font-mono font-bold text-lime-400 text-sm tracking-wider">
                            <IconTicket className="w-3.5 h-3.5" />{c.code}
                          </span>
                        </td>
                        <td className="p-3.5 border-b border-zinc-800/60 text-zinc-400">
                          <span className="inline-flex items-center gap-1.5">
                            <IconLink className="w-3.5 h-3.5 text-zinc-600" />
                            {c.offer_name || 'Standard Coupon'}
                          </span>
                        </td>
                        <td className="p-3.5 border-b border-zinc-800/60">
                          <span className="font-semibold text-white tabular-nums">{c.used_count}</span>
                          {c.max_uses ? <span className="text-zinc-500 tabular-nums"> / {c.max_uses}</span> : <span className="text-zinc-500"> / ∞</span>}
                        </td>
                        <td className="p-3.5 border-b border-zinc-800/60 text-zinc-400">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'No expiry'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE OFFER MODAL */}
      {activeModal === 'offer' && (
        <ModalWrapper title="Create Campaign Offer" icon={<IconGift className="w-4.5 h-4.5" />} onClose={() => setActiveModal(null)}>
          <form onSubmit={handleCreateOffer} className="space-y-4">
            <div>
              <label className={labelCls}>Offer Title *</label>
              <div className={fieldWrapCls}>
                <IconTag className={fieldIconCls} />
                <input type="text" required placeholder="e.g. New Year 20% Off" value={offerForm.name} onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input type="text" placeholder="Short description for receipt" value={offerForm.description} onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })} className={inputPlainCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type *</label>
                <select value={offerForm.discount_type} onChange={(e) => setOfferForm({ ...offerForm, discount_type: e.target.value })} className={inputPlainCls}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Flat (₹)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Discount Value *</label>
                <input type="number" step="0.01" required placeholder={offerForm.discount_type === 'percentage' ? 'e.g. 15' : 'e.g. 500'} value={offerForm.discount_value} onChange={(e) => setOfferForm({ ...offerForm, discount_value: e.target.value })} className={inputPlainCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start Date</label>
                <div className={fieldWrapCls}>
                  <IconCalendar className={fieldIconCls} />
                  <input type="date" value={offerForm.start_date} onChange={(e) => setOfferForm({ ...offerForm, start_date: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>End Date</label>
                <div className={fieldWrapCls}>
                  <IconCalendar className={fieldIconCls} />
                  <input type="date" value={offerForm.end_date} onChange={(e) => setOfferForm({ ...offerForm, end_date: e.target.value })} className={inputCls} />
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Max Uses (Optional)</label>
              <div className={fieldWrapCls}>
                <IconLayers className={fieldIconCls} />
                <input type="number" placeholder="Leave empty for unlimited" value={offerForm.max_uses} onChange={(e) => setOfferForm({ ...offerForm, max_uses: e.target.value })} className={inputCls} />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-b from-lime-400 to-lime-400 text-zinc-950 text-xs font-bold rounded-xl hover:brightness-105 disabled:opacity-50 mt-2 transition shadow-[0_4px_16px_-4px] shadow-lime-400/50">
              {submitting && <span className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />}
              {submitting ? 'Creating...' : 'Save Offer Campaign'}
            </button>
          </form>
        </ModalWrapper>
      )}

      {/* CREATE COUPON MODAL */}
      {activeModal === 'coupon' && (
        <ModalWrapper title="Generate Coupon Code" icon={<IconTicket className="w-4.5 h-4.5" />} onClose={() => setActiveModal(null)}>
          <form onSubmit={handleCreateCoupon} className="space-y-4">
            <div>
              <label className={labelCls}>Link to Offer Campaign</label>
              <div className={fieldWrapCls}>
                <IconLink className={fieldIconCls} />
                <select value={couponForm.offer_id} onChange={(e) => setCouponForm({ ...couponForm, offer_id: e.target.value })} className={`${inputCls} appearance-none`}>
                  <option value="">Select linked campaign</option>
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} ({o.discount_type === 'percentage' ? `${o.discount_value}%` : `₹${o.discount_value}`})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Coupon Promo Code *</label>
              <div className={fieldWrapCls}>
                <IconTicket className={fieldIconCls} />
                <input type="text" required placeholder="e.g. FITINDIA20" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className={`${inputCls} font-mono tracking-wider`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Max Uses</label>
                <div className={fieldWrapCls}>
                  <IconLayers className={fieldIconCls} />
                  <input type="number" placeholder="e.g. 50" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Expiration Date</label>
                <div className={fieldWrapCls}>
                  <IconCalendar className={fieldIconCls} />
                  <input type="date" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} className={inputCls} />
                </div>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-b from-lime-400 to-lime-400 text-zinc-950 text-xs font-bold rounded-xl hover:brightness-105 disabled:opacity-50 mt-2 transition shadow-[0_4px_16px_-4px] shadow-lime-400/50">
              {submitting && <span className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />}
              {submitting ? 'Generating...' : 'Create Coupon'}
            </button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}

function ModalWrapper({ title, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center text-lime-400">
              {icon}
            </div>
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition">
            <IconClose className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}