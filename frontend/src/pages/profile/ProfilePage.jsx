import React, { useState, useEffect } from 'react';
import { apiGet, apiPut, apiPost } from '../../api';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password'
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Owner Form State
  const [ownerForm, setOwnerForm] = useState({
    owner_name: '',
    phone: '',
    email: '',
    gym_name: '',
    legal_name: '',
    tax_id_gst: '',
    primary_branch_id: '',
    branch_name: '',
    address_line1: '',
    city: '',
    state: '',
    pincode: '',
    opening_time: '',
    closing_time: ''
  });

  // Trainer Form State
  const [trainerForm, setTrainerForm] = useState({
    name: '',
    phone: '',
    email: '',
    designation: '',
    specializations: ''
  });

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/v1/profile/me');
      if (res?.success) {
        setData(res);

        // Populate Owner Form
        if (res.profile_type === 'owner' && res.owner_data) {
          const org = res.owner_data.organization || {};
          const branch = res.owner_data.primary_branch || {};
          setOwnerForm({
            owner_name: res.user?.name || '',
            phone: res.user?.phone || '',
            email: res.user?.email || '',
            gym_name: org.gym_name || '',
            legal_name: org.legal_name || '',
            tax_id_gst: org.tax_id_gst || '',
            primary_branch_id: branch.id || '',
            branch_name: branch.name || '',
            address_line1: branch.address_line1 || '',
            city: branch.city || '',
            state: branch.state || '',
            pincode: branch.pincode || '',
            opening_time: branch.opening_time || '',
            closing_time: branch.closing_time || ''
          });
        }

        // Populate Trainer Form
        if (res.profile_type === 'trainer' && res.trainer_data) {
          const staff = res.trainer_data.staff_info || {};
          setTrainerForm({
            name: res.user?.name || '',
            phone: res.user?.phone || '',
            email: res.user?.email || '',
            designation: staff.designation || 'Fitness Trainer',
            specializations: (res.trainer_data.specializations || []).join(', ')
          });
        }
      } else {
        setErrorMsg(res?.message || 'Profile data load nahi ho paya.');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleOwnerSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await apiPut('/api/v1/profile/update-owner', ownerForm);
      if (res?.success) {
        setSuccessMsg(res.message);
        await fetchProfile();
      } else {
        setErrorMsg(res?.message || 'Update failed.');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Request error.');
    } finally {
      setSaving(false);
    }
  };

  const handleTrainerSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const payload = {
        ...trainerForm,
        specializations: trainerForm.specializations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      };
      const res = await apiPut('/api/v1/profile/update-trainer', payload);
      if (res?.success) {
        setSuccessMsg(res.message);
        await fetchProfile();
      } else {
        setErrorMsg(res?.message || 'Update failed.');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Request error.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setErrorMsg('Naya password aur confirm password match nahi ho rahe.');
      return;
    }
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await apiPost('/api/v1/profile/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      if (res?.success) {
        setSuccessMsg(res.message);
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        setErrorMsg(res?.message || 'Password badla nahi ja saka.');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Request error.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 text-xs font-mono tracking-wider">Loading Profile Ledger...</p>
        </div>
      </div>
    );
  }

  const isOwner = data?.profile_type === 'owner';
  const isTrainer = data?.profile_type === 'trainer';
  const user = data?.user || {};
  const org = data?.owner_data?.organization || {};
  const staff = data?.trainer_data?.staff_info || {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner / Hero Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-lime-400/5 blur-3xl pointer-events-none rounded-full" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-lime-400 to-lime-200 text-zinc-950 font-black text-2xl flex items-center justify-center shadow-lg uppercase">
              {user.name ? user.name.slice(0, 2) : 'GY'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-wide">{user.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-lime-400/10 text-lime-400 border border-lime-400/20">
                  {isOwner ? '👑 GYM OWNER' : (isTrainer ? '🏋️ TRAINER / STAFF' : 'USER')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-3 font-mono">
                <span>📱 {user.phone}</span>
                {user.email && <span>✉️ {user.email}</span>}
                {isOwner && org.gym_name && <span className="text-zinc-300 font-bold">🏢 {org.gym_name}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'profile'
                  ? 'bg-lime-400 text-zinc-950 shadow-md'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              👤 Profile Details
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'password'
                  ? 'bg-lime-400 text-zinc-950 shadow-md'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              🔒 Security & Password
            </button>
          </div>
        </div>

        {/* Feedback Toasts */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center justify-between">
            <span>✅ {successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-zinc-400 hover:text-white">✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-zinc-400 hover:text-white">✕</button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PROFILE DETAILS                                         */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* ==================== A. GYM OWNER PROFILE ==================== */}
          {isOwner && (
            <>
              {/* Gym & SaaS Metrics Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    SaaS Subscription Plan
                  </span>
                  <p className="text-lg font-bold font-mono text-lime-400 capitalize">
                    {org.plan_name || 'Standard Pro'}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Status: <strong className="text-emerald-400 uppercase">{org.subscription_status || 'Trial'}</strong>
                  </span>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Total Members Enrolled
                  </span>
                  <p className="text-2xl font-bold font-mono text-white">
                    {data?.owner_data?.stats?.total_members || 0}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">Across all branches</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Active Gym Branches
                  </span>
                  <p className="text-2xl font-bold font-mono text-white">
                    {data?.owner_data?.stats?.total_branches || 1}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">Max Cap: {org.max_branches || 'Unlimited'}</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Trainers & Staff
                  </span>
                  <p className="text-2xl font-bold font-mono text-white">
                    {data?.owner_data?.stats?.active_staff || 0}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">Active employees</span>
                </div>
              </div>

              {/* Edit Form for Gym Owner */}
              <form onSubmit={handleOwnerSave} className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">Gym Business & Owner Identity</h2>
                    <p className="text-xs text-zinc-400">Gym owner ki personal contact details aur commercial business legal information</p>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Section 1: Owner Info */}
                  <div>
                    <h3 className="text-xs font-bold uppercase text-lime-400 tracking-wider mb-3">1. Owner Personal Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Owner Full Name *</label>
                        <input
                          type="text"
                          required
                          value={ownerForm.owner_name}
                          onChange={(e) => setOwnerForm({ ...ownerForm, owner_name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Phone (Login ID) *</label>
                        <input
                          type="text"
                          required
                          value={ownerForm.phone}
                          onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Official Email</label>
                        <input
                          type="email"
                          value={ownerForm.email}
                          onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-zinc-800/80" />

                  {/* Section 2: Gym Organization */}
                  <div>
                    <h3 className="text-xs font-bold uppercase text-lime-400 tracking-wider mb-3">2. Gym Legal & Tax Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Brand / Gym Name *</label>
                        <input
                          type="text"
                          required
                          value={ownerForm.gym_name}
                          onChange={(e) => setOwnerForm({ ...ownerForm, gym_name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Legal Registered Entity Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Iron Fitness Pvt. Ltd."
                          value={ownerForm.legal_name}
                          onChange={(e) => setOwnerForm({ ...ownerForm, legal_name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">GSTIN Number</label>
                        <input
                          type="text"
                          placeholder="e.g. 08ABCDE1234F1Z5"
                          value={ownerForm.tax_id_gst}
                          onChange={(e) => setOwnerForm({ ...ownerForm, tax_id_gst: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-zinc-800/80" />

                  {/* Section 3: Primary Branch Location */}
                  <div>
                    <h3 className="text-xs font-bold uppercase text-lime-400 tracking-wider mb-3">3. Head Branch Details & Operating Timings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Branch Name</label>
                        <input
                          type="text"
                          value={ownerForm.branch_name}
                          onChange={(e) => setOwnerForm({ ...ownerForm, branch_name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Address Line</label>
                        <input
                          type="text"
                          value={ownerForm.address_line1}
                          onChange={(e) => setOwnerForm({ ...ownerForm, address_line1: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">City</label>
                        <input
                          type="text"
                          value={ownerForm.city}
                          onChange={(e) => setOwnerForm({ ...ownerForm, city: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">State</label>
                        <input
                          type="text"
                          value={ownerForm.state}
                          onChange={(e) => setOwnerForm({ ...ownerForm, state: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Pincode</label>
                        <input
                          type="text"
                          value={ownerForm.pincode}
                          onChange={(e) => setOwnerForm({ ...ownerForm, pincode: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Gym Opening Time</label>
                        <input
                          type="time"
                          value={ownerForm.opening_time}
                          onChange={(e) => setOwnerForm({ ...ownerForm, opening_time: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Gym Closing Time</label>
                        <input
                          type="time"
                          value={ownerForm.closing_time}
                          onChange={(e) => setOwnerForm({ ...ownerForm, closing_time: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </>
          )}

          {/* ==================== B. TRAINER / STAFF PROFILE ==================== */}
          {isTrainer && (
            <>
              {/* Trainer Performance & Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Employee Code
                  </span>
                  <p className="text-xl font-bold font-mono text-lime-400">{staff.employee_code || 'EMP-01'}</p>
                  <span className="text-[10px] text-zinc-500 font-mono">Branch: {staff.branch_name || 'Main'}</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Active PT Clients
                  </span>
                  <p className="text-2xl font-bold font-mono text-white">
                    {data?.trainer_data?.pt_stats?.active_pt_clients || 0}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">Assigned members</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    PT Sessions (Delivered/Total)
                  </span>
                  <p className="text-xl font-bold font-mono text-white">
                    {data?.trainer_data?.pt_stats?.used_pt_sessions || 0} / {data?.trainer_data?.pt_stats?.total_pt_sessions || 0}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">Sessions logged</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                    Shift Timings
                  </span>
                  <p className="text-sm font-bold font-mono text-amber-400">
                    {staff.shift_start_time ? `${staff.shift_start_time.slice(0, 5)} - ${staff.shift_end_time.slice(0, 5)}` : 'Full Day'}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Weekly Off: {staff.weekly_off === 0 ? 'Sunday' : `Day ${staff.weekly_off}`}
                  </span>
                </div>
              </div>

              {/* Trainer Details Form */}
              <form onSubmit={handleTrainerSave} className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">Trainer & Fitness Instructor Profile</h2>
                    <p className="text-xs text-zinc-400">Personal identity, specializations, aur operational roster info</p>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : '💾 Update Profile'}
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Trainer Full Name *</label>
                      <input
                        type="text"
                        required
                        value={trainerForm.name}
                        onChange={(e) => setTrainerForm({ ...trainerForm, name: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Phone Number *</label>
                      <input
                        type="text"
                        required
                        value={trainerForm.phone}
                        onChange={(e) => setTrainerForm({ ...trainerForm, phone: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Email ID</label>
                      <input
                        type="email"
                        value={trainerForm.email}
                        onChange={(e) => setTrainerForm({ ...trainerForm, email: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Designation</label>
                      <input
                        type="text"
                        value={trainerForm.designation}
                        onChange={(e) => setTrainerForm({ ...trainerForm, designation: e.target.value })}
                        placeholder="e.g. Senior CrossFit & Strength Coach"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                        Specializations (comma separated)
                      </label>
                      <input
                        type="text"
                        value={trainerForm.specializations}
                        onChange={(e) => setTrainerForm({ ...trainerForm, specializations: e.target.value })}
                        placeholder="e.g. Hypertrophy, Fat Loss, Powerlifting, Diet"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Read Only Payroll & Shift Structure */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2">Employment & Compensation (Configured by Gym Owner)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Payout Model:</span>
                        <span className="font-bold text-white capitalize">{staff.payout_type || 'Fixed'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Monthly Salary:</span>
                        <span className="font-bold text-lime-400">₹{parseFloat(staff.monthly_fixed_salary || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Hourly Rate:</span>
                        <span className="font-bold text-white">₹{parseFloat(staff.hourly_rate || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">PT Commission:</span>
                        <span className="font-bold text-white">{staff.commission_percentage || 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              {/* Assigned Members Ledger Table */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase text-white tracking-wider">Active Members Assigned Under You</h3>
                  <span className="text-xs font-mono text-lime-400">
                    {(data?.trainer_data?.assigned_members || []).length} Members
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950/80 text-zinc-500 uppercase border-b border-zinc-800 tracking-wider">
                      <tr>
                        <th className="py-3 px-5">Member Code</th>
                        <th className="py-3 px-5">Member Name</th>
                        <th className="py-3 px-5">Contact</th>
                        <th className="py-3 px-5">Assigned Date</th>
                        <th className="py-3 px-5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {(data?.trainer_data?.assigned_members || []).map((m) => (
                        <tr key={m.id} className="hover:bg-zinc-800/30">
                          <td className="py-3 px-5 text-lime-400 font-bold">{m.member_code}</td>
                          <td className="py-3 px-5 text-white font-semibold font-sans">{m.first_name} {m.last_name || ''}</td>
                          <td className="py-3 px-5 text-zinc-400">{m.phone}</td>
                          <td className="py-3 px-5 text-zinc-400">{new Date(m.assigned_from).toLocaleDateString('en-IN')}</td>
                          <td className="py-3 px-5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!data?.trainer_data?.assigned_members || data.trainer_data.assigned_members.length === 0) && (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-zinc-500 font-sans">
                            Filhal koi active gym member assigned nahi hai.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SECURITY & PASSWORD CHANGE                              */}
      {/* ============================================================== */}
      {activeTab === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-xl mx-auto shadow-2xl space-y-4">
          <div className="border-b border-zinc-800 pb-3 mb-4">
            <h2 className="text-base font-bold text-white tracking-wide">Change Security Password</h2>
            <p className="text-xs text-zinc-400">Account login password ko update karein</p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Current Password *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">New Password (Min 6 chars) *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Confirm New Password *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg disabled:opacity-50"
            >
              {saving ? 'Updating Password...' : '🔒 Update Account Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}