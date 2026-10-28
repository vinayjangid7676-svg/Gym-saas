import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPostFormData, API_BASE_URL } from '../api';
import MembershipLifecycleModal from './MembershipLifecycleModal';
import MemberFitnessHub from '../components/MemberFitnessHub';

export default function MemberDetail() {
  const { hashId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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
  const canManagePlansAndBilling = isManagement || isReception;

  const [basicMember, setBasicMember] = useState(null);
  const [subrecords, setSubrecords] = useState(null);
  const [memberClasses, setMemberClasses] = useState([]);
  const [ptEnrollments, setPtEnrollments] = useState([]);
  const [availableSchedules, setAvailableSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Photo states
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Modals state
  const [isLifecycleModalOpen, setIsLifecycleModalOpen] = useState(false);
  const [openModal, setOpenModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [conditionForm, setConditionForm] = useState({ condition_name: '', severity: 'moderate', notes: '', diagnosed_on: '' });
  const [injuryForm, setInjuryForm] = useState({ injury_name: '', body_part: '', occurred_on: '', notes: '' });
  const [goalForm, setGoalForm] = useState({ goal_type: 'weight_loss', title: '', target_value: '', unit: 'kg', target_date: '' });
  const [compForm, setCompForm] = useState({ visceral_fat: '', water_percent: '', bone_mass_kg: '', basal_metabolic_rate: '', metabolic_age: '', device_name: 'InBody 270', notes: '' });
  const [docForm, setDocForm] = useState({ document_type: 'national_id', document_number: '', document_url: '', issued_on: '', expires_on: '' });
  const [noteForm, setNoteForm] = useState({ note_type: 'general', note: '', is_private: true });
  const [tagForm, setTagForm] = useState({ name: '', color: '#84cc16' });
  const [assignClassForm, setAssignClassForm] = useState({ class_schedule_id: '' });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsPhotoLightboxOpen(false);
    };
    if (isPhotoLightboxOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPhotoLightboxOpen]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const memberRes = await apiGet(`/api/v1/members/${hashId}`);
    if (memberRes?.success && memberRes.data) {
      const memObj = memberRes.data;
      setBasicMember(memObj);

      const rawMemberId = memObj.id || memObj.numeric_id;
      const parsedId = rawMemberId ? parseInt(rawMemberId, 10) : null;

      if (parsedId && !isNaN(parsedId)) {
        const [subRes, clsRes, ptRes] = await Promise.all([
          apiGet(`/api/v1/subrecords/members/${parsedId}`).catch(() => ({ success: false })),
          apiGet(`/api/v1/classes/member/${parsedId}`).catch(() => ({ success: false })),
          apiGet(`/api/v1/pt/enrollments?member_id=${parsedId}`).catch(() => ({ success: false }))
        ]);

        if (subRes?.success) setSubrecords(subRes.data);
        if (clsRes?.success) setMemberClasses(clsRes.data || []);
        if (ptRes?.success) setPtEnrollments(ptRes.data || []);
      }
    } else {
      alert(memberRes?.message || 'Member profile load nahi hui.');
      navigate('/members');
    }
    setLoading(false);
  }, [hashId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getFullImageUrl = (url) => {
    if (!url || typeof url !== 'string' || !url.trim()) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const cleanBase = API_BASE_URL.replace(/\/$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanUrl}`;
  };

  // Direct Photo Upload Handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Photo size 3MB se kam honi chahiye.');
      return;
    }

    const formData = new FormData();
    formData.append('profile_image', file);

    setUploadingPhoto(true);
    try {
      const res = await apiPostFormData(`/api/v1/members/${hashId}/photo`, formData);
      if (res?.success) {
        alert('Photo successfully update ho gayi!');
        await loadData();
      } else {
        alert(res?.message || 'Photo upload fail hua.');
      }
    } catch (err) {
      alert('Network error while uploading photo.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadAvailableSchedules = async () => {
    setClassesLoading(true);
    const branchId = basicMember?.branch_id || basicMember?.primary_branch_id;
    const res = await apiGet(`/api/v1/classes/schedules${branchId ? `?branch_id=${branchId}` : ''}`);
    if (res?.success) setAvailableSchedules(res.data || []);
    setClassesLoading(false);
  };

  const handleSubrecordSubmit = async (endpoint, payload, resetFn) => {
    const memberId = basicMember?.id || basicMember?.numeric_id;
    if (!memberId) return alert('Member ID nahi mili!');
    setSubmitting(true);
    const res = await apiPost(endpoint, { member_id: parseInt(memberId, 10), ...payload });
    if (res?.success) {
      resetFn();
      setOpenModal(null);
      await loadData();
    } else {
      alert(res?.message || 'Save error.');
    }
    setSubmitting(false);
  };

  const handleBookClassSubmit = async (e) => {
    e.preventDefault();
    const memberId = basicMember?.id || basicMember?.numeric_id;
    if (!assignClassForm.class_schedule_id) return alert('Batch select karein.');
    setSubmitting(true);
    const res = await apiPost('/api/v1/classes/book', {
      member_id: parseInt(memberId, 10),
      class_schedule_id: parseInt(assignClassForm.class_schedule_id, 10),
    });
    if (res?.success) {
      alert('Class assign ho gayi!');
      setAssignClassForm({ class_schedule_id: '' });
      setOpenModal(null);
      await loadData();
    } else {
      alert(res?.message || 'Class book nahi ho saki.');
    }
    setSubmitting(false);
  };

  const handlePunchMemberPT = async (enrollmentId) => {
    if (!window.confirm('Kya aap 1 PT workout session punch karna chahte hain?')) return;
    setSubmitting(true);
    const res = await apiPost('/api/v1/pt/sessions', {
      enrollment_id: enrollmentId,
      scheduled_start: new Date().toISOString(),
      status: 'completed',
      notes: 'Logged from Member 360'
    });
    if (res?.success) {
      alert('Session logged!');
      await loadData();
    } else {
      alert(res?.message || 'Punch fail.');
    }
    setSubmitting(false);
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Booking cancel karni hai?')) return;
    const res = await apiPost('/api/v1/classes/cancel', { booking_id: bookingId });
    if (res?.success) {
      alert('Cancelled.');
      await loadData();
    }
  };

  const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none';
  const labelCls = 'text-xs text-zinc-400 block mb-1';

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 max-w-5xl mx-auto mt-6">
        Loading 360° Member Data...
      </div>
    );
  }

  if (!basicMember) return null;

  const profilePhotoUrl = getFullImageUrl(basicMember.profile_image_url);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      {/* Hidden File Input for direct photo upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/webp"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/members')} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition">
            ← Directory
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Member 360° Profile</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 font-mono text-lime-400 uppercase">
                {currentRole} Access
              </span>
            </div>
            <p className="text-xs text-zinc-400">Complete fitness assessment, KYC, and plan management</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManagePlansAndBilling && (
           // MemberDetail.jsx me line 203 par update karein:
<button
  onClick={() => {
    navigate(
      `/billing/create-invoice?member_id=${basicMember.id || basicMember.numeric_id}&member_name=${encodeURIComponent(basicMember.first_name + ' ' + (basicMember.last_name || ''))}&type=class`
    );
  }}
  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 text-xs font-bold rounded-xl transition"
>
  🗓️ Bill / Assign Class
</button>
          )}
          <button onClick={() => setOpenModal('tag')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-700 transition">
            🏷️ Add Tag
          </button>
          <button onClick={() => setOpenModal('note')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-700 transition">
            📝 Add Note
          </button>
          {canManagePlansAndBilling && basicMember.active_membership && (
            <button onClick={() => setIsLifecycleModalOpen(true)} className="px-4 py-2 bg-lime-400 text-zinc-950 font-bold text-xs rounded-xl hover:bg-lime-300 transition shadow-sm">
              ⚡ Manage Plan
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Col: Identity Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
          <div className="text-center">
            {/* Interactive Photo Avatar */}
            <div className="relative group w-28 h-28 mx-auto mb-3">
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt="Profile"
                  onClick={() => setIsPhotoLightboxOpen(true)}
                  className="w-28 h-28 rounded-full object-cover border-2 border-lime-400/60 shadow-lg shadow-lime-400/10 cursor-pointer transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-28 h-28 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center font-bold text-3xl text-lime-400 mx-auto cursor-pointer hover:border-lime-400 transition"
                  title="Click to upload profile photo"
                >
                  <span>{basicMember.first_name?.[0]?.toUpperCase()}</span>
                  <span className="text-[10px] text-zinc-400 font-normal mt-1">Upload Photo</span>
                </div>
              )}

              {/* Hover Overlay */}
              {profilePhotoUrl && (
                <div
                  onClick={() => setIsPhotoLightboxOpen(true)}
                  className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                  title="Click to view full screen"
                >
                  <span className="text-white text-xs font-bold">🔍 View HD</span>
                </div>
              )}
            </div>

            {/* Direct Upload / Change Button */}
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="mb-3 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-lime-400 text-xs font-bold rounded-lg border border-zinc-700 transition"
            >
              {uploadingPhoto ? 'Uploading...' : '📷 Change Photo'}
            </button>

            <h2 className="text-lg font-bold text-white">
              {basicMember.first_name} {basicMember.middle_name || ''} {basicMember.last_name || ''}
            </h2>
            <p className="text-xs font-mono text-lime-400">{basicMember.member_code}</p>

            <div className="mt-2 flex justify-center gap-1.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                basicMember.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                basicMember.status === 'frozen' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {basicMember.status.toUpperCase()}
              </span>
              {subrecords?.tags?.map((t) => (
                <span key={t.id} style={{ borderColor: t.color }} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 border text-zinc-200">
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4 space-y-2 text-xs">
            <div>
              <span className="text-zinc-500 block">Phone</span>
              <span className="text-zinc-200 font-medium font-mono">{basicMember.phone}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Email</span>
              <span className="text-zinc-200 font-medium">{basicMember.email || '—'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Branch</span>
              <span className="text-zinc-200 font-medium">{basicMember.branch_name} ({basicMember.branch_code})</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Join Date</span>
              <span className="text-zinc-200 font-medium">{new Date(basicMember.join_date).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">RFID / Barcode</span>
              <span className="text-lime-400 font-mono">{basicMember.barcode_rfid || 'Unassigned'}</span>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Emergency Contact</h4>
            {subrecords?.emergency_contacts?.length > 0 ? (
              subrecords.emergency_contacts.map((c) => (
                <div key={c.id || c.phone} className="text-xs space-y-0.5">
                  <p className="text-white font-medium">{c.name} ({c.relationship || 'Contact'})</p>
                  <p className="text-zinc-400 font-mono">{c.phone}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">No contact provided.</p>
            )}
          </div>
        </div>

        {/* Right Col: Workspace Tabs */}
        <div className="lg:col-span-3 space-y-5">
          <div className="flex gap-2 border-b border-zinc-800 pb-2 flex-wrap">
            {[
              { id: 'overview', label: 'Membership, PT & Lockers' },
              { id: 'fitness', label: '🏋 Fitness, Workout & Diet' },
              { id: 'classes', label: `Studio Classes (${memberClasses?.length || 0})` },
              ...(canManagePlansAndBilling ? [{ id: 'billing', label: `Billing & Invoices (${basicMember.invoices?.length || 0})` }] : []),
              { id: 'health', label: `Health & Medical (${(subrecords?.medical_conditions?.length || 0) + (subrecords?.injuries?.length || 0)})` },
              { id: 'documents', label: `Documents (${subrecords?.documents?.length || 0})` },
              { id: 'notes', label: `Staff Notes (${subrecords?.notes?.length || 0})` },
              { id: 'renewals', label: `Renewal History (${subrecords?.renewals?.length || 0})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                  activeTab === tab.id
                    ? 'bg-lime-400 text-zinc-950 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 0: FITNESS */}
          {activeTab === 'fitness' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <MemberFitnessHub
                memberId={basicMember.numeric_id || basicMember.id}
                memberName={`${basicMember.first_name} ${basicMember.last_name || ''}`}
              />
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Current Active General Membership</span>
                  {basicMember.active_membership && (
                    <span className="text-xs font-mono text-lime-400">ID: {basicMember.active_membership.hash_id}</span>
                  )}
                </h3>
                {basicMember.active_membership ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 block mb-1">Plan Name</span>
                      <span className="text-white font-bold text-sm">{basicMember.active_membership.plan_name}</span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 block mb-1">Duration</span>
                      <span className="text-zinc-200">
                        {new Date(basicMember.active_membership.start_date).toLocaleDateString()} to {new Date(basicMember.active_membership.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 block mb-1">Total Fee</span>
                      <span className="text-white font-semibold">₹{basicMember.active_membership.total_amount}</span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 block mb-1">Due Amount</span>
                      <span className={`font-bold ${parseFloat(basicMember.active_membership.due_amount) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        ₹{basicMember.active_membership.due_amount}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                    No active general membership assigned currently.
                  </div>
                )}
              </div>

              {/* PT Sessions */}
              {ptEnrollments.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Personal Training (PT) Packages</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lime-400/10 text-lime-400 border border-lime-400/20 font-mono">
                        {ptEnrollments.length} Active
                      </span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ptEnrollments.map((pt) => {
                      const used = parseInt(pt.sessions_used, 10);
                      const total = parseInt(pt.sessions_total, 10);
                      const left = total - used;
                      const percent = Math.min(100, Math.round((used / total) * 100));
                      const isDone = left <= 0;

                      return (
                        <div key={pt.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-mono text-lime-400 font-bold uppercase">{pt.plan_name}</span>
                              <h4 className="text-white font-bold text-sm">Trainer: {pt.trainer_name}</h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                              isDone ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {pt.status}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-zinc-400">Sessions Meter</span>
                              <span className={isDone ? 'text-red-400 font-bold' : 'text-zinc-200'}>
                                {used} / {total} ({left} Remaining)
                              </span>
                            </div>
                            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                className={`h-full transition-all duration-300 ${isDone ? 'bg-red-500' : 'bg-lime-400'}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          <div className="pt-2 border-t border-zinc-800/80 flex justify-between items-center text-[11px]">
                            <span className="text-zinc-500">Expires: {new Date(pt.end_date).toLocaleDateString()}</span>
                            {!isDone && (
                              <button
                                onClick={() => handlePunchMemberPT(pt.id)}
                                className="px-3 py-1 bg-lime-400 hover:bg-lime-300 text-zinc-950 rounded-lg font-bold text-xs transition"
                              >
                                ⏱ Punch Session (-1)
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lockers */}
              {basicMember.lockers?.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white">🔐 Assigned Lockers</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {basicMember.lockers.map((lk) => (
                      <div key={lk.id} className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs flex justify-between items-center">
                        <div>
                          <strong className="text-white text-sm block">Locker #{lk.locker_number}</strong>
                          <span className="text-zinc-500">Valid: {new Date(lk.start_date).toLocaleDateString()} - {new Date(lk.end_date).toLocaleDateString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lime-400 font-mono font-bold block">₹{lk.monthly_rent}/mo</span>
                          <span className="text-[10px] text-zinc-500">Deposit: ₹{lk.security_deposit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STUDIO CLASSES */}
          {activeTab === 'classes' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Assigned Studio Classes</h3>
                  <p className="text-xs text-zinc-400">Complete historical and upcoming batch enrollments</p>
                </div>
                {canManagePlansAndBilling && (
                  // MemberDetail.jsx me line 203 par update karein:
<button
  onClick={() => {
    navigate(
      `/billing/create-invoice?member_id=${basicMember.id || basicMember.numeric_id}&member_name=${encodeURIComponent(basicMember.first_name + ' ' + (basicMember.last_name || ''))}&type=class`
    );
  }}
  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 text-xs font-bold rounded-xl transition"
>
  🗓️ Bill / Assign Class
</button>
                )}
              </div>

              {memberClasses?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {memberClasses.map((item) => {
                    const startObj = new Date(item.start_time);
                    const endObj = new Date(item.end_time);
                    const isWaitlist = item.booking_status === 'waitlist';

                    return (
                      <div
                        key={item.booking_id || item.booking_hash_id}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm">{item.class_name}</span>
                            {isWaitlist ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Waitlist #{item.waitlist_queue_position}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Confirmed
                              </span>
                            )}
                          </div>

                          <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1 text-xs">
                            <div className="flex justify-between text-zinc-300">
                              <span className="text-zinc-500">Date:</span>
                              <span className="text-white">{startObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span className="text-zinc-500">Timing:</span>
                              <span className="font-semibold text-lime-400 font-mono">
                                {startObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span className="text-zinc-500">Trainer:</span>
                              <span>{item.trainer_name || 'Assigned Trainer'}</span>
                            </div>
                          </div>
                        </div>

                        {!isWaitlist && canManagePlansAndBilling && (
                          <div className="pt-2 border-t border-zinc-800 flex justify-end">
                            <button
                              onClick={() => handleCancelBooking(item.booking_id)}
                              className="text-xs text-red-400 hover:text-red-300 font-medium transition"
                            >
                              Cancel Booking ✕
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-10 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl text-xs">
                  No classes assigned to this member yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BILLING */}
          {activeTab === 'billing' && canManagePlansAndBilling && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Invoices & Financial Ledger</h3>
                  <p className="text-xs text-zinc-400">Complete payment transactions and GST receipts</p>
                </div>
                <button
                  onClick={() => navigate('/billing/create-invoice')}
                  className="px-3 py-1.5 bg-lime-400 text-zinc-950 font-bold text-xs rounded-xl hover:bg-lime-300 transition"
                >
                  + New Invoice
                </button>
              </div>

              {basicMember.invoices?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950 text-zinc-500 uppercase border-b border-zinc-800">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Total (₹)</th>
                        <th className="p-3">Paid (₹)</th>
                        <th className="p-3">Due (₹)</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {basicMember.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-zinc-800/40 transition">
                          <td className="p-3 font-mono font-bold text-lime-400">{inv.invoice_number}</td>
                          <td className="p-3">{new Date(inv.created_at).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inv.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              inv.payment_status === 'partially_paid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {inv.payment_status}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-semibold text-white">₹{parseFloat(inv.total_amount).toFixed(2)}</td>
                          <td className="p-3 font-mono text-emerald-400">₹{parseFloat(inv.paid_amount || 0).toFixed(2)}</td>
                          <td className="p-3 font-mono font-bold text-red-400">₹{parseFloat(inv.due_amount || 0).toFixed(2)}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => navigate(`/billing`)}
                              className="text-xs text-lime-400 hover:underline font-semibold"
                            >
                              View Receipt →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl text-xs">
                  No invoices billed yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: HEALTH & MEDICAL */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setOpenModal('condition')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold rounded-xl border border-zinc-700 transition">
                  + Medical Condition
                </button>
                <button onClick={() => setOpenModal('injury')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 text-xs font-semibold rounded-xl border border-zinc-700 transition">
                  + Injury Log
                </button>
                <button onClick={() => setOpenModal('goal')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-semibold rounded-xl border border-zinc-700 transition">
                  + Fitness Goal
                </button>
                <button onClick={() => setOpenModal('composition')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-xs font-semibold rounded-xl border border-zinc-700 transition">
                  + InBody Composition
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-amber-400">🩺 Medical Conditions</h4>
                  {subrecords?.medical_conditions?.length > 0 ? (
                    <div className="space-y-2">
                      {subrecords.medical_conditions.map((mc) => (
                        <div key={mc.id} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
                          <div className="flex justify-between font-semibold text-white">
                            <span>{mc.condition_name}</span>
                            <span className="capitalize text-amber-400">{mc.severity}</span>
                          </div>
                          {mc.notes && <p className="text-zinc-400 mt-1">{mc.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">No medical condition logged.</p>
                  )}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-red-400">🩹 Injury History</h4>
                  {subrecords?.injuries?.length > 0 ? (
                    <div className="space-y-2">
                      {subrecords.injuries.map((inj) => (
                        <div key={inj.id} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
                          <div className="flex justify-between font-semibold text-white">
                            <span>{inj.injury_name}</span>
                            <span className="text-zinc-400">{inj.body_part}</span>
                          </div>
                          {inj.notes && <p className="text-zinc-400 mt-1">{inj.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">No injuries reported.</p>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-bold text-emerald-400">🎯 Fitness Goals</h4>
                {subrecords?.goals?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subrecords.goals.map((g) => (
                      <div key={g.id} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-1">
                        <p className="font-semibold text-white">{g.title}</p>
                        <p className="text-lime-400 font-mono">Target: {g.target_value} {g.unit}</p>
                        {g.target_date && <p className="text-zinc-500 text-[11px]">Target Date: {new Date(g.target_date).toLocaleDateString()}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No goals assigned.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white">Member Identification & Documents</h3>
                  <p className="text-xs text-zinc-400">KYC verification records and documents</p>
                </div>
                <button onClick={() => setOpenModal('doc')} className="px-3 py-2 bg-lime-400 text-zinc-950 text-xs font-bold rounded-xl hover:bg-lime-300 transition">
                  + Record Document
                </button>
              </div>
              {subrecords?.documents?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subrecords.documents.map((doc) => (
                    <div key={doc.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white uppercase">{doc.document_type.replace('_', ' ')}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {doc.verification_status}
                        </span>
                      </div>
                      <p className="text-zinc-400 font-mono">{doc.document_number ? `No: ${doc.document_number}` : 'No document number'}</p>
                      {doc.document_url && (
                        <a href={doc.document_url} target="_blank" rel="noreferrer" className="text-lime-400 hover:underline block pt-1">
                          View Uploaded Link ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl text-xs">
                  No documents recorded.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: NOTES */}
          {activeTab === 'notes' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white">Internal Staff Notes</h3>
                  <p className="text-xs text-zinc-400">Confidential observations and workout notes</p>
                </div>
                <button onClick={() => setOpenModal('note')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-lime-400 border border-zinc-700 text-xs font-bold rounded-xl transition">
                  + Add Note
                </button>
              </div>
              {subrecords?.notes?.length > 0 ? (
                <div className="space-y-3">
                  {subrecords.notes.map((n) => (
                    <div key={n.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className="font-semibold text-white">{n.author_name || 'Staff User'}</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-zinc-200 text-sm whitespace-pre-wrap">{n.note}</p>
                      <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 uppercase">
                        {n.note_type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl text-xs">
                  No notes recorded yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 7: RENEWALS */}
          {activeTab === 'renewals' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">Membership Renewal Log</h3>
              {subrecords?.renewals?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950 text-zinc-500 uppercase border-b border-zinc-800">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Renewed By</th>
                        <th className="p-2.5">Plan Name</th>
                        <th className="p-2.5">Old ID</th>
                        <th className="p-2.5">New ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {subrecords.renewals.map((rnw) => (
                        <tr key={rnw.id} className="hover:bg-zinc-800/30 transition">
                          <td className="p-2.5">{new Date(rnw.renewed_at).toLocaleString()}</td>
                          <td className="p-2.5 font-semibold text-white">{rnw.renewed_by_name || 'Staff'}</td>
                          <td className="p-2.5 text-lime-400">{rnw.plan_name || 'Membership'}</td>
                          <td className="p-2.5 font-mono text-zinc-500">#{rnw.old_membership_id}</td>
                          <td className="p-2.5 font-mono text-lime-400">#{rnw.new_membership_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No past renewals on record.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ────────────────── FULLSCREEN PHOTO LIGHTBOX MODAL ────────────────── */}
      {isPhotoLightboxOpen && profilePhotoUrl && (
        <div
          onClick={() => setIsPhotoLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center"
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 px-1">
              <div>
                <h4 className="text-base font-bold text-white">
                  {basicMember.first_name} {basicMember.middle_name || ''} {basicMember.last_name || ''}
                </h4>
                <p className="text-xs font-mono text-lime-400">{basicMember.member_code}</p>
              </div>
              <button
                onClick={() => setIsPhotoLightboxOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl flex items-center justify-center max-h-[70vh]">
              <img
                src={profilePhotoUrl}
                alt={`${basicMember.first_name}'s Profile`}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl border border-zinc-800 shadow-2xl"
              />
            </div>

            <div className="w-full pt-3 text-center">
              <span className="text-[11px] text-zinc-500 font-mono">Press ESC or click anywhere outside to close</span>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── SUBRECORD POPUP MODALS ────────────────── */}

      {openModal === 'book_class' && (
        <ModalWrapper title="Assign / Enroll In Class" onClose={() => setOpenModal(null)}>
          <form onSubmit={handleBookClassSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Select Class Batch & Timing *</label>
              {classesLoading ? (
                <div className="text-xs text-zinc-500 py-3">Batches load ho rahe hain...</div>
              ) : availableSchedules.length > 0 ? (
                <select
                  required
                  value={assignClassForm.class_schedule_id}
                  onChange={(e) => setAssignClassForm({ class_schedule_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Batch select karein --</option>
                  {availableSchedules.map((sch) => {
                    const start = new Date(sch.start_time);
                    const isFull = parseInt(sch.booked_count, 10) >= parseInt(sch.max_capacity, 10);
                    return (
                      <option key={sch.id} value={sch.id}>
                        {sch.class_name} | {start.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({sch.duration_minutes}m) {isFull ? '• [FULL - Waitlist]' : `• [${sch.booked_count}/${sch.max_capacity}]`}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-amber-400">
                  Is branch ke liye koi upcoming scheduled class batch active nahi hai.
                </div>
              )}
            </div>
            <SubmitButton loading={submitting} label="Enroll Member Into Batch" />
          </form>
        </ModalWrapper>
      )}

      {openModal === 'condition' && (
        <ModalWrapper title="Record Medical Condition" onClose={() => setOpenModal(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubrecordSubmit('/api/v1/subrecords/health/conditions', conditionForm, () => setConditionForm({ condition_name: '', severity: 'moderate', notes: '', diagnosed_on: '' }));
          }} className="space-y-3">
            <div>
              <label className={labelCls}>Condition Name *</label>
              <input type="text" required placeholder="e.g. Hypertension, Asthma" value={conditionForm.condition_name} onChange={(e) => setConditionForm({ ...conditionForm, condition_name: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Severity</label>
                <select value={conditionForm.severity} onChange={(e) => setConditionForm({ ...conditionForm, severity: e.target.value })} className={inputCls}>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Diagnosed On</label>
                <input type="date" value={conditionForm.diagnosed_on} onChange={(e) => setConditionForm({ ...conditionForm, diagnosed_on: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea rows="2" value={conditionForm.notes} onChange={(e) => setConditionForm({ ...conditionForm, notes: e.target.value })} className={inputCls} />
            </div>
            <SubmitButton loading={submitting} label="Save Condition" />
          </form>
        </ModalWrapper>
      )}

      {openModal === 'injury' && (
        <ModalWrapper title="Log Injury" onClose={() => setOpenModal(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubrecordSubmit('/api/v1/subrecords/health/injuries', injuryForm, () => setInjuryForm({ injury_name: '', body_part: '', occurred_on: '', notes: '' }));
          }} className="space-y-3">
            <div>
              <label className={labelCls}>Injury Name *</label>
              <input type="text" required placeholder="e.g. ACL Tear, Shoulder Impingement" value={injuryForm.injury_name} onChange={(e) => setInjuryForm({ ...injuryForm, injury_name: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Body Part</label>
                <input type="text" placeholder="e.g. Left Knee" value={injuryForm.body_part} onChange={(e) => setInjuryForm({ ...injuryForm, body_part: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Occurred On</label>
                <input type="date" value={injuryForm.occurred_on} onChange={(e) => setInjuryForm({ ...injuryForm, occurred_on: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Precautions / Notes</label>
              <textarea rows="2" value={injuryForm.notes} onChange={(e) => setInjuryForm({ ...injuryForm, notes: e.target.value })} className={inputCls} />
            </div>
            <SubmitButton loading={submitting} label="Save Injury" />
          </form>
        </ModalWrapper>
      )}

      {openModal === 'goal' && (
        <ModalWrapper title="Add Fitness Goal" onClose={() => setOpenModal(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubrecordSubmit('/api/v1/subrecords/health/goals', goalForm, () => setGoalForm({ goal_type: 'weight_loss', title: '', target_value: '', unit: 'kg', target_date: '' }));
          }} className="space-y-3">
            <div>
              <label className={labelCls}>Title *</label>
              <input type="text" required placeholder="e.g. Bench press 100kg" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select value={goalForm.goal_type} onChange={(e) => setGoalForm({ ...goalForm, goal_type: e.target.value })} className={inputCls}>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="endurance">Endurance</option>
                  <option value="strength">Strength</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Target Value</label>
                <input type="text" placeholder="e.g. 100" value={goalForm.target_value} onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <input type="text" placeholder="kg, reps, %" value={goalForm.unit} onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Target Date</label>
              <input type="date" value={goalForm.target_date} onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })} className={inputCls} />
            </div>
            <SubmitButton loading={submitting} label="Save Goal" />
          </form>
        </ModalWrapper>
      )}

      {openModal === 'composition' && (
        <ModalWrapper title="Record InBody Scan" onClose={() => setOpenModal(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubrecordSubmit('/api/v1/subrecords/health/composition', compForm, () => setCompForm({ visceral_fat: '', water_percent: '', bone_mass_kg: '', basal_metabolic_rate: '', metabolic_age: '', device_name: 'InBody 270', notes: '' }));
          }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Visceral Fat</label>
                <input type="number" step="0.1" value={compForm.visceral_fat} onChange={(e) => setCompForm({ ...compForm, visceral_fat: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Water Percentage (%)</label>
                <input type="number" step="0.1" value={compForm.water_percent} onChange={(e) => setCompForm({ ...compForm, water_percent: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Bone Mass (kg)</label>
                <input type="number" step="0.1" value={compForm.bone_mass_kg} onChange={(e) => setCompForm({ ...compForm, bone_mass_kg: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>BMR (kcal)</label>
                <input type="number" value={compForm.basal_metabolic_rate} onChange={(e) => setCompForm({ ...compForm, basal_metabolic_rate: e.target.value })} className={inputCls} />
              </div>
            </div>
            <SubmitButton loading={submitting} label="Save Scan" />
          </form>
        </ModalWrapper>
      )}

      {openModal === 'doc' && (
        <ModalWrapper title="Add Member Document" onClose={() => setOpenModal(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubrecordSubmit('/api/v1/subrecords/documents', docForm, () => setDocForm({ document_type: 'national_id', document_number: '', document_url: '', issued_on: '', expires_on: '' }));
          }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Document Type *</label>
                <select value={docForm.document_type} onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })} className={inputCls}>
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="medical_certificate">Medical Certificate</option>
                  <option value="agreement">Gym Agreement</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Document Number</label>
                <input type="text" placeholder="e.g. DL-12345" value={docForm.document_number} onChange={(e) => setDocForm({ ...docForm, document_number: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>File URL / Cloud Link</label>
              <input type="url" placeholder="https://..." value={docForm.document_url} onChange={(e) => setDocForm({ ...docForm, document_url: e.target.value })} className={inputCls} />
            </div>
            <SubmitButton loading={submitting} label="Save Document" />
          </form>
        </ModalWrapper>
      )}

      {openModal === 'note' && (
        <ModalWrapper title="Internal Staff Note" onClose={() => setOpenModal(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubrecordSubmit('/api/v1/subrecords/notes', noteForm, () => setNoteForm({ note_type: 'general', note: '', is_private: true }));
          }} className="space-y-3">
            <div>
              <label className={labelCls}>Note Category</label>
              <select value={noteForm.note_type} onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })} className={inputCls}>
                <option value="general">General Observation</option>
                <option value="behavior">Discipline / Behavior</option>
                <option value="billing">Fee & Billing Discussion</option>
                <option value="training">Training Progress</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Note Content *</label>
              <textarea rows="3" required placeholder="Write internal gym note..." value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} className={inputCls} />
            </div>
            <SubmitButton loading={submitting} label="Post Staff Note" />
          </form>
        </ModalWrapper>
      )}

      {openModal === 'tag' && (
        <ModalWrapper title="Assign Tag" onClose={() => setOpenModal(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubrecordSubmit('/api/v1/subrecords/tags', tagForm, () => setTagForm({ name: '', color: '#84cc16' }));
          }} className="space-y-3">
            <div>
              <label className={labelCls}>Tag Name *</label>
              <input type="text" required placeholder="e.g. VIP, Morning Batch, Powerlifter" value={tagForm.name} onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Badge Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={tagForm.color} onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })} className="bg-transparent cursor-pointer rounded h-8 w-12 border-0" />
                <span className="text-xs font-mono text-zinc-400">{tagForm.color}</span>
              </div>
            </div>
            <SubmitButton loading={submitting} label="Assign Tag" />
          </form>
        </ModalWrapper>
      )}

      {/* Membership Lifecycle Modal */}
      {basicMember.active_membership && (
        <MembershipLifecycleModal
          isOpen={isLifecycleModalOpen}
          onClose={() => setIsLifecycleModalOpen(false)}
          membership={{
            ...basicMember.active_membership,
            id: basicMember.active_membership.hash_id || basicMember.active_membership.id,
            member_id: basicMember.numeric_id || basicMember.id,
            member_name: `${basicMember.first_name} ${basicMember.last_name || ''}`
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-base transition">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SubmitButton({ loading, label }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2.5 bg-lime-400 text-zinc-950 text-xs font-bold rounded-xl hover:bg-lime-300 transition disabled:opacity-50 mt-2 shadow-sm"
    >
      {loading ? 'Saving...' : label}
    </button>
  );
}