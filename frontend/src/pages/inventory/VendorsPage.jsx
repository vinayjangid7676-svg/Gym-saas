import React, { useState } from 'react';
import { apiPost } from '../../api';
import { InvNav, ModalWrapper, Feedback, useInventoryData, inputCls, labelCls } from './InventoryShared';

const emptyVendor = { name: '', phone: '', email: '', address: '', tax_id_gst: '' };

export default function VendorsPage() {
  const { vendors, loading, refresh } = useInventoryData();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyVendor);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Note: vendors inventory me bhi expenses ke same table se aate hain (shared vendor master)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(''); setError('');
    const res = await apiPost('/api/v1/expenses/vendors', form);
    if (res?.success) {
      setSuccess(`Vendor "${res.vendor.name}" register ho gaya.`);
      setForm(emptyVendor);
      setShowModal(false);
      refresh();
    } else {
      setError(res?.message || 'Vendor register nahi hua.');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory Vendors</h1>
          <p className="text-sm text-zinc-400">Supplement suppliers aur distributors</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-sm font-bold rounded-xl">
          + Add Vendor
        </button>
      </div>

      <InvNav />
      <Feedback success={success} error={error} onDismiss={() => { setSuccess(''); setError(''); }} />

      {loading ? (
        <p className="p-12 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800 text-sm">Loading...</p>
      ) : vendors.length === 0 ? (
        <p className="p-10 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800 text-sm">Koi vendor nahi. "+ Add Vendor" se shuru karein.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-white text-sm">{v.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ACTIVE</span>
              </div>
              <p className="text-xs text-zinc-400">📞 {v.phone || '—'}</p>
              {v.email && <p className="text-xs text-zinc-400">✉️ {v.email}</p>}
              {v.tax_id_gst && <p className="text-xs text-zinc-500">GST: {v.tax_id_gst}</p>}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalWrapper title="Register New Vendor" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelCls}>Vendor / Company Name *</label>
              <input type="text" name="name" required placeholder="e.g. MuscleBlaze Distributors" value={form.name} onChange={handleChange} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phone</label>
                <input type="text" name="phone" value={form.phone} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>GST / Tax ID</label>
              <input type="text" name="tax_id_gst" value={form.tax_id_gst} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input type="text" name="address" value={form.address} onChange={handleChange} className={inputCls} />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm rounded-xl disabled:opacity-50">
              {submitting ? 'Saving...' : 'Register Vendor'}
            </button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}