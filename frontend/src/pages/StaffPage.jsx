import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiPut } from '../api';

const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition shadow-inner';
const labelCls = 'text-[11px] text-zinc-400 block mb-1.5 font-semibold uppercase tracking-wider';

const COMMON_DEGREES = [
  'ACE Certified',
  'ISSA Personal Trainer',
  'CrossFit L1',
  'K11 Fitness Academy',
  'Gold Gym University Certified',
  'Clinical Nutritionist',
  'Powerlifting Coach',
  'Yoga Alliance 200hr',
  'CPR/AED Certified'
];

const INITIAL_FORM = {
  name: '',
  phone: '',
  email: '',
  password: 'Staff@123',
  designation: 'Senior Fitness Coach',
  role_slug: 'trainer',
  employee_code: '',
  payout_type: 'fixed',
  monthly_fixed_salary: '',
  hourly_rate: '',
  commission_percentage: '15',
  shift_start_time: '06:00',
  shift_end_time: '14:00',
  weekly_off: '0',
  specializations: ['ACE Certified']
};

export default function StaffPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customSkillInput, setCustomSkillInput] = useState('');

  const [form, setForm] = useState(INITIAL_FORM);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const activeBranchId = localStorage.getItem('gym_active_branch_id') || '';
      let url = '/api/v1/staff';
      if (activeBranchId) url += `?branch_id=${activeBranchId}`;

      const res = await apiGet(url);
      if (res?.success) setStaffList(res.data || []);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Staff profiles load karte waqt error aaya.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery) ||
        s.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.designation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? s.is_active
          : !s.is_active;

      return matchesSearch && matchesStatus;
    });
  }, [staffList, searchQuery, statusFilter]);

  const toggleSkill = (skill) => {
    setForm((prev) => {
      const exists = prev.specializations.includes(skill);
      return {
        ...prev,
        specializations: exists
          ? prev.specializations.filter((s) => s !== skill)
          : [...prev.specializations, skill]
      };
    });
  };

  const addCustomSkill = (e) => {
    e.preventDefault();
    if (!customSkillInput.trim()) return;
    const item = customSkillInput.trim();
    if (!form.specializations.includes(item)) {
      setForm((prev) => ({
        ...prev,
        specializations: [...prev.specializations, item]
      }));
    }
    setCustomSkillInput('');
  };

  const removeSkill = (skillToRemove) => {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.filter((s) => s !== skillToRemove)
    }));
  };

  const handleEditClick = (staff) => {
    setEditingStaffId(staff.hash_id || staff.id);
    setForm({
      name: staff.name,
      phone: staff.phone,
      email: staff.email || '',
      password: '',
      designation: staff.designation || '',
      role_slug: staff.role_slug || 'trainer',
      employee_code: staff.employee_code || '',
      payout_type: staff.payout_type || 'fixed',
      monthly_fixed_salary: staff.monthly_fixed_salary || '',
      hourly_rate: staff.hourly_rate || '',
      commission_percentage: staff.commission_percentage || '0',
      shift_start_time: staff.shift_start_time ? staff.shift_start_time.slice(0, 5) : '06:00',
      shift_end_time: staff.shift_end_time ? staff.shift_end_time.slice(0, 5) : '14:00',
      weekly_off: String(staff.weekly_off || 0),
      specializations: Array.isArray(staff.skills) ? staff.skills.map(s => typeof s === 'string' ? s : s.name) : []
    });
    setShowModal(true);
  };

  const handleAttendanceAction = async (staffId, action) => {
    try {
      const res = await apiPost('/api/v1/staff/attendance', { staff_id: staffId, action });
      if (res?.success) {
        setMessage({ 
          type: 'success', 
          text: `Attendance updated: ${action === 'clock_in' ? 'Clocked In successfully' : 'Clocked Out. Aaj ki shift complete!'}` 
        });
        loadStaff();
      } else {
        setMessage({ type: 'error', text: res?.message || 'Attendance update nahi ho saki.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Attendance toggle request fail ho gayi.' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const activeBranchId = localStorage.getItem('gym_active_branch_id') || 1;

    const payload = {
      ...form,
      branch_id: parseInt(activeBranchId, 10),
      shift_start_time: form.shift_start_time ? `${form.shift_start_time}:00` : null,
      shift_end_time: form.shift_end_time ? `${form.shift_end_time}:00` : null,
      monthly_fixed_salary: form.monthly_fixed_salary ? parseFloat(form.monthly_fixed_salary) : 0,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : 0,
      commission_percentage: form.commission_percentage ? parseFloat(form.commission_percentage) : 0,
      weekly_off: parseInt(form.weekly_off, 10)
    };

    let res;
    if (editingStaffId) {
      res = await apiPut(`/api/v1/staff/${editingStaffId}`, payload);
    } else {
      res = await apiPost('/api/v1/staff', payload);
    }

    if (res?.success) {
      setMessage({ type: 'success', text: res.message || 'Staff member details saved.' });
      setShowModal(false);
      setEditingStaffId(null);
      setForm(INITIAL_FORM);
      loadStaff();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Staff profile save karne me issue aaya.' });
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Metrics & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-wide">Staff & Trainers Directory</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-800 text-lime-400 border border-zinc-700">
              {staffList.length} Total
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Enterprise roster management, real-time shifts, commissions, and certifications.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingStaffId(null);
            setForm(INITIAL_FORM);
            setShowModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-[0_0_20px_rgba(163,230,53,0.3)]"
        >
          <span>+</span> Add Team Member
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Search by name, employee ID, phone or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-zinc-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-lime-400"
          >
            <option value="all">All Employment Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive / Resigned</option>
          </select>
        </div>
      </div>

      {/* Feedback Banner */}
      {message.text && (
        <div className={`p-4 rounded-xl text-xs font-bold border flex justify-between items-center ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
            : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* Staff Grid */}
      {loading ? (
        <div className="py-24 text-center text-zinc-500 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl text-xs">
          Syncing branch workforce directory...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((st) => {
            const clockIn = st.today_attendance?.clock_in;
            const clockOut = st.today_attendance?.clock_out;
            const isCompletedForToday = Boolean(clockIn && clockOut);
            const isOnFloor = Boolean(clockIn && !clockOut);
            const isNotClockedIn = !clockIn;

            return (
              <div 
                key={st.hash_id || st.id} 
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-lime-400 bg-lime-400/10 px-2 py-0.5 rounded border border-lime-400/20">
                          {st.employee_code}
                        </span>
                        <span className="text-[10px] uppercase font-mono text-zinc-500">
                          {st.role_name || 'Staff'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1.5">{st.name}</h3>
                      <p className="text-xs text-zinc-400">{st.designation}</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${
                      st.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}>
                      {st.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </div>

                  {/* Skills Badges */}
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {st.skills && st.skills.length > 0 ? (
                      st.skills.map((skill, sIdx) => {
                        const label = typeof skill === 'string' ? skill : skill.name;
                        return (
                          <span 
                            key={sIdx} 
                            className="px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-[10px] font-medium text-zinc-300 flex items-center gap-1"
                          >
                            <span className="text-lime-400">✓</span> {label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-zinc-600 italic">No formal certifications linked</span>
                    )}
                  </div>

                  {/* Operational Metrics */}
                  <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-2 font-mono">
                    <div className="flex justify-between text-zinc-400">
                      <span>Phone:</span>
                      <span className="text-white select-all">{st.phone}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Shift:</span>
                      <span className="text-zinc-300">
                        {st.shift_start_time ? `${st.shift_start_time.slice(0, 5)} - ${st.shift_end_time.slice(0, 5)}` : 'Flexible'}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Payout Mode:</span>
                      <span className="text-lime-400 font-bold capitalize">
                        {st.payout_type} {st.payout_type === 'fixed' && st.monthly_fixed_salary ? `(₹${st.monthly_fixed_salary})` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        isCompletedForToday 
                          ? 'bg-zinc-500' 
                          : isOnFloor 
                          ? 'bg-emerald-400 animate-pulse' 
                          : 'bg-zinc-600'
                      }`} />
                      <span className="text-[11px] text-zinc-400">
                        {isCompletedForToday 
                          ? `Shift Completed (${st.today_attendance?.worked_minutes || 0}m)` 
                          : isOnFloor 
                          ? 'On Floor (Clocked In)' 
                          : 'Off Duty'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-white font-mono text-[11px]">
                      {st.active_pt_count || 0} PT Clients
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Punch In / Out / Completed Button with strict Daily Disable */}
                    {isCompletedForToday ? (
                      <button
                        type="button"
                        disabled
                        className="py-1.5 rounded-lg text-[10px] font-bold uppercase bg-zinc-950 text-zinc-500 border border-zinc-800/80 cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        <span>✓</span> Completed
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAttendanceAction(st.hash_id || st.id, isOnFloor ? 'clock_out' : 'clock_in')}
                        className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition border ${
                          isOnFloor
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isOnFloor ? 'Clock Out' : 'Clock In'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleEditClick(st)}
                      className="py-1.5 rounded-lg text-[10px] font-bold uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredStaff.length === 0 && (
            <div className="col-span-full py-20 text-center text-zinc-500 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl text-xs space-y-2">
              <span className="text-3xl block">👤</span>
              <p className="font-semibold text-zinc-300">Koi matching staff member nahi mila.</p>
              <p className="text-zinc-500">Filter parameters adjust karein ya naya staff register karein.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add / Edit Staff Member */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {editingStaffId ? 'Update Staff Member Profile' : 'Register New Staff Member'}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Tenant-scoped roles, compensation models, shift policies & qualifications
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white transition">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Rana"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mobile Number (Login Identifier) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9829012345"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Email Address</label>
                  <input
                    type="email"
                    placeholder="trainer@gym.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Designation</label>
                  <input
                    type="text"
                    placeholder="Senior Coach"
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>System Role</label>
                  <select
                    value={form.role_slug}
                    onChange={(e) => setForm({ ...form, role_slug: e.target.value })}
                    className={inputCls}
                  >
                    <option value="trainer">Trainer / Coach</option>
                    <option value="receptionist">Front Desk Executive</option>
                    <option value="manager">Branch Operations Manager</option>
                  </select>
                </div>
              </div>

              {!editingStaffId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Employee Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="Leave blank for Auto STF-XXXX"
                      value={form.employee_code}
                      onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Initial Portal Password *</label>
                    <input
                      type="password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Working Shifts & Roster Configuration */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                <label className={labelCls}>Duty Shift & Weekly Off</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-1">Shift Start</span>
                    <input
                      type="time"
                      value={form.shift_start_time}
                      onChange={(e) => setForm({ ...form, shift_start_time: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-1">Shift End</span>
                    <input
                      type="time"
                      value={form.shift_end_time}
                      onChange={(e) => setForm({ ...form, shift_end_time: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-1">Weekly Off</span>
                    <select
                      value={form.weekly_off}
                      onChange={(e) => setForm({ ...form, weekly_off: e.target.value })}
                      className={inputCls}
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Qualifications & Certifications */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2.5">
                <label className={labelCls}>Certifications & Skillsets</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_DEGREES.map((deg) => {
                    const isSelected = form.specializations.includes(deg);
                    return (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => toggleSkill(deg)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border ${
                          isSelected
                            ? 'bg-lime-400 text-zinc-950 border-lime-400'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {deg}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Custom Certification / Degree..."
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 font-bold text-xs rounded-xl border border-zinc-700 shrink-0"
                  >
                    + Add
                  </button>
                </div>

                {form.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-850">
                    {form.specializations.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded text-[10px] flex items-center gap-1.5">
                        {s}
                        <button type="button" onClick={() => removeSkill(s)} className="text-zinc-500 hover:text-red-400">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Payout Structure */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Payout Model</label>
                  <select
                    value={form.payout_type}
                    onChange={(e) => setForm({ ...form, payout_type: e.target.value })}
                    className={inputCls}
                  >
                    <option value="fixed">Fixed Monthly Salary</option>
                    <option value="commission">Commission Only</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Base Fixed Salary (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 25000"
                    value={form.monthly_fixed_salary}
                    onChange={(e) => setForm({ ...form, monthly_fixed_salary: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>PT Commission (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 15"
                    value={form.commission_percentage}
                    onChange={(e) => setForm({ ...form, commission_percentage: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2 shadow-[0_0_15px_rgba(163,230,53,0.2)]"
              >
                {submitting ? 'Committing Changes...' : editingStaffId ? 'Update Staff Profile' : 'Save & Register Staff Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}