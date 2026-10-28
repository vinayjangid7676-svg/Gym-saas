import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiPostFormData } from '../api';
import { useBranch } from '../context/BranchContext';

const fontMono = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };

const emptyForm = () => ({
  primary_branch_id: '',
  member_code: `MBR-${Math.floor(1000 + Math.random() * 9000)}`,
  first_name: '',
  middle_name: '',
  last_name: '',
  phone: '',
  alternate_phone: '',
  email: '',
  gender: 'male',
  date_of_birth: '',
  blood_group: '',
  marital_status: 'single',
  barcode_rfid: '',
  join_date: new Date().toISOString().split('T')[0],
  referral_member_id: '',
  lead_source: '',
  notes: '',
  whatsapp_opt_in: true,
  sms_opt_in: true,
  email_opt_in: true,
  address: { address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'India' },
  emergency_contact: { name: '', relationship: '', phone: '', alternate_phone: '', email: '' },
});

export default function AddMember() {
  const navigate = useNavigate();
  const { branches, activeBranch, loading: branchLoading } = useBranch();
  const [formData, setFormData] = useState(emptyForm());
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null); // Success Pop-up state
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeBranch?.id) {
      setFormData((prev) => ({
        ...prev,
        primary_branch_id: activeBranch.id
      }));
    }
  }, [activeBranch]);

  const inputCls =
    'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none transition';
  const labelCls = 'text-xs text-zinc-400 block mb-1.5 font-medium';

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleNestedChange = (section, e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [section]: { ...formData[section], [name]: value } });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setErrorMsg('Image file size must be less than 3MB.');
        return;
      }
      setErrorMsg('');
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitLoading(true);

    const data = new FormData();

    if (imageFile) {
      data.append('profile_image', imageFile);
    }

    data.append('primary_branch_id', formData.primary_branch_id || activeBranch?.id);
    data.append('member_code', formData.member_code);
    data.append('first_name', formData.first_name);
    data.append('middle_name', formData.middle_name || '');
    data.append('last_name', formData.last_name || '');
    data.append('phone', formData.phone);
    data.append('alternate_phone', formData.alternate_phone || '');
    data.append('email', formData.email || '');
    data.append('gender', formData.gender);
    data.append('marital_status', formData.marital_status);
    data.append('date_of_birth', formData.date_of_birth || '');
    data.append('blood_group', formData.blood_group || '');
    data.append('barcode_rfid', formData.barcode_rfid || '');
    data.append('join_date', formData.join_date);
    data.append('lead_source', formData.lead_source || '');
    data.append('referral_member_id', formData.referral_member_id || '');
    data.append('notes', formData.notes || '');
    data.append('whatsapp_opt_in', String(formData.whatsapp_opt_in));
    data.append('sms_opt_in', String(formData.sms_opt_in));
    data.append('email_opt_in', String(formData.email_opt_in));

    if (formData.address.address_line1) {
      data.append('address', JSON.stringify(formData.address));
    }
    if (formData.emergency_contact.name && formData.emergency_contact.phone) {
      data.append('emergency_contact', JSON.stringify(formData.emergency_contact));
    }

    try {
      const res = await apiPostFormData('/api/v1/members', data);
      if (res?.success) {
        setSuccessData({
          name: `${formData.first_name} ${formData.last_name || ''}`.trim(),
          member_code: formData.member_code,
          phone: formData.phone,
          branch_name: branches.find((b) => b.id === formData.primary_branch_id)?.name || activeBranch?.name || 'Main Facility'
        });

        // 2.8 seconds ke baad auto-redirect
        setTimeout(() => {
          navigate('/members');
        }, 2800);
      } else {
        setErrorMsg(res?.message || 'Unable to register member. Please check required fields.');
      }
    } catch (err) {
      setErrorMsg('Network error. Failed to communicate with server.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 font-sans antialiased text-zinc-100">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-lime-400 uppercase">
            Enrollment Gateway
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            Register New Member
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Biometric facial capture, gate credential assignment, and personal ledger profiling.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/members')}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
        >
          ← Back to List
        </motion.button>
      </div>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2"
        >
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        
        {/* Profile Image Multer Upload */}
        <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-2 text-zinc-500">
                <span className="text-2xl block">📷</span>
                <span style={fontMono} className="text-[10px] uppercase font-bold text-zinc-400">
                  Face ID
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div>
              <p className="text-xs font-bold text-white tracking-tight">Member Profile Photograph</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Optical camera verification for turnstile gate relay and digital pass (Max 3MB, JPG/PNG).
              </p>
            </div>

            <div className="flex items-center gap-2 justify-center sm:justify-start pt-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg text-lime-400 border border-zinc-700 transition"
              >
                Choose Photo 📁
              </motion.button>
              {imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold rounded-lg text-red-400 border border-red-500/30 transition"
                >
                  Remove ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Branch Selection & RFID Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Assigned Facility / Branch *</label>
            {branches.length > 1 ? (
              <select
                name="primary_branch_id"
                value={formData.primary_branch_id}
                onChange={handleChange}
                required
                className={`${inputCls} font-semibold`}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 flex items-center justify-between">
                <span>{activeBranch?.name || 'Main Facility Branch'}</span>
                <span
                  style={fontMono}
                  className="text-[9px] bg-lime-400/10 text-lime-400 border border-lime-400/20 px-2 py-0.5 rounded font-bold uppercase"
                >
                  AUTO_ASSIGNED
                </span>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Barcode / RFID Tag</label>
            <input
              type="text"
              name="barcode_rfid"
              placeholder="Scan or enter RFID / Wiegand code"
              style={fontMono}
              value={formData.barcode_rfid}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
        </div>

        {/* Member Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input
              type="text"
              name="first_name"
              required
              value={formData.first_name}
              onChange={handleChange}
              className={inputCls}
              placeholder="e.g. Aryan"
            />
          </div>
          <div>
            <label className={labelCls}>Middle Name</label>
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleChange}
              className={inputCls}
              placeholder="Middle name"
            />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className={inputCls}
              placeholder="e.g. Sharma"
            />
          </div>
        </div>

        {/* Phone & Member Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Primary Mobile (WhatsApp) *</label>
            <input
              type="tel"
              name="phone"
              required
              style={fontMono}
              value={formData.phone}
              onChange={handleChange}
              className={inputCls}
              placeholder="10-digit phone number"
            />
          </div>
          <div>
            <label className={labelCls}>Member Code *</label>
            <input
              type="text"
              name="member_code"
              required
              style={fontMono}
              value={formData.member_code}
              onChange={handleChange}
              className={`${inputCls} uppercase`}
            />
          </div>
        </div>

        {/* Alternate Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Alternate Phone</label>
            <input
              type="tel"
              name="alternate_phone"
              style={fontMono}
              value={formData.alternate_phone}
              onChange={handleChange}
              className={inputCls}
              placeholder="Secondary contact"
            />
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={inputCls}
              placeholder="member@domain.com"
            />
          </div>
        </div>

        {/* Demographics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange} className={inputCls}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marital Status</label>
            <select name="marital_status" value={formData.marital_status} onChange={handleChange} className={inputCls}>
              <option value="single">Single</option>
              <option value="married">Married</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input
              type="date"
              name="date_of_birth"
              style={fontMono}
              value={formData.date_of_birth}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Blood Group</label>
            <input
              type="text"
              name="blood_group"
              style={fontMono}
              value={formData.blood_group}
              onChange={handleChange}
              className={inputCls}
              placeholder="e.g. B+, O+"
            />
          </div>
        </div>

        {/* Join Date, Source, Referral */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Join Date *</label>
            <input
              type="date"
              name="join_date"
              required
              style={fontMono}
              value={formData.join_date}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Lead Source</label>
            <input
              type="text"
              name="lead_source"
              value={formData.lead_source}
              onChange={handleChange}
              className={inputCls}
              placeholder="Walk-in, Instagram, Friend"
            />
          </div>
          <div>
            <label className={labelCls}>Referral Member ID</label>
            <input
              type="number"
              name="referral_member_id"
              style={fontMono}
              value={formData.referral_member_id}
              onChange={handleChange}
              className={inputCls}
              placeholder="e.g. 1024"
            />
          </div>
        </div>

        {/* Address */}
        <div className="border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3 bg-zinc-950/40">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Residential Address (Optional)</h4>
          <input
            type="text"
            name="address_line1"
            placeholder="Address Line 1 (Street / Building)"
            value={formData.address.address_line1}
            onChange={(e) => handleNestedChange('address', e)}
            className={inputCls}
          />
          <input
            type="text"
            name="address_line2"
            placeholder="Address Line 2 (Apartment / Landmark)"
            value={formData.address.address_line2}
            onChange={(e) => handleNestedChange('address', e)}
            className={inputCls}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              name="city"
              placeholder="City"
              value={formData.address.city}
              onChange={(e) => handleNestedChange('address', e)}
              className={inputCls}
            />
            <input
              type="text"
              name="state"
              placeholder="State"
              value={formData.address.state}
              onChange={(e) => handleNestedChange('address', e)}
              className={inputCls}
            />
            <input
              type="text"
              name="postal_code"
              placeholder="PIN Code"
              style={fontMono}
              value={formData.address.postal_code}
              onChange={(e) => handleNestedChange('address', e)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3 bg-zinc-950/40">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Emergency Contact (Optional)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              name="name"
              placeholder="Contact Person Name"
              value={formData.emergency_contact.name}
              onChange={(e) => handleNestedChange('emergency_contact', e)}
              className={inputCls}
            />
            <input
              type="text"
              name="relationship"
              placeholder="Relationship (e.g. Father, Spouse)"
              value={formData.emergency_contact.relationship}
              onChange={(e) => handleNestedChange('emergency_contact', e)}
              className={inputCls}
            />
            <input
              type="tel"
              name="phone"
              placeholder="Emergency Contact Phone"
              style={fontMono}
              value={formData.emergency_contact.phone}
              onChange={(e) => handleNestedChange('emergency_contact', e)}
              className={inputCls}
            />
            <input
              type="email"
              name="email"
              placeholder="Emergency Contact Email"
              value={formData.emergency_contact.email}
              onChange={(e) => handleNestedChange('emergency_contact', e)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Internal Medical & Training Notes</label>
          <textarea
            name="notes"
            rows="2"
            value={formData.notes}
            onChange={handleChange}
            className={inputCls}
            placeholder="Medical conditions, trainer assignments, or custom instructions..."
          />
        </div>

        <div className="flex flex-wrap gap-6 text-xs text-zinc-300 pt-1">
          {['whatsapp_opt_in', 'sms_opt_in', 'email_opt_in'].map((f) => (
            <label key={f} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name={f}
                checked={formData[f]}
                onChange={handleChange}
                className="accent-lime-400 w-4 h-4 cursor-pointer"
              />
              <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400">
                {f.replace('_opt_in', '')} Alerts
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-5 border-t border-zinc-800">
          <button
            type="button"
            onClick={() => navigate('/members')}
            className="px-5 py-2.5 rounded-xl text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitLoading || branchLoading}
            className="px-6 py-2.5 rounded-xl text-xs bg-lime-400 text-black hover:bg-lime-300 font-extrabold uppercase tracking-wider disabled:opacity-50 transition shadow-lg shadow-lime-400/20"
          >
            {submitLoading ? 'Registering & Uploading...' : 'Save & Enroll Member →'}
          </motion.button>
        </div>
      </form>

      {/* ================= SUCCESS POPUP MODAL ================= */}
      <AnimatePresence>
        {successData && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 25 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Top ambient green glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-lime-400/15 blur-3xl pointer-events-none rounded-full" />

              {/* Pulsing Success Checkmark Rig */}
              <div className="relative flex items-center justify-center my-4">
                <motion.div
                  animate={{ scale: [1, 1.45, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-24 h-24 rounded-full bg-lime-400/20"
                />
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                  className="w-20 h-20 rounded-full bg-lime-400 text-black flex items-center justify-center text-4xl font-black shadow-xl shadow-lime-400/35 relative z-10"
                >
                  ✓
                </motion.div>
              </div>

              {/* Title & Microcopy */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="space-y-1.5 mt-4"
              >
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Member Enrolled Successfully!
                </h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Profile image, biometric gate access, and membership ledger have been initialized.
                </p>
              </motion.div>

              {/* Member Card Summary Snippet */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-left space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Member Name</span>
                  <span className="text-xs font-bold text-white">{successData.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Member Code</span>
                  <span style={fontMono} className="text-xs font-bold text-lime-400">
                    {successData.member_code}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Assigned Hub</span>
                  <span className="text-xs text-zinc-300 font-medium">{successData.branch_name}</span>
                </div>
              </motion.div>

              {/* Manual Nav CTA and Auto-redirect indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28 }}
                className="mt-6 space-y-3"
              >
                <button
                  type="button"
                  onClick={() => navigate('/members')}
                  className="w-full py-3 rounded-xl bg-lime-400 text-black font-extrabold text-xs uppercase tracking-wider hover:bg-lime-300 transition shadow-lg shadow-lime-400/20"
                >
                  Go to Member Directory →
                </button>

                <p style={fontMono} className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
                  Auto-redirecting in a few seconds...
                </p>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}