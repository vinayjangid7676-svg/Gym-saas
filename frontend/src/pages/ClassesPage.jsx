// import React, { useState, useEffect, useCallback } from 'react';
// import { apiGet, apiPost } from '../api';
// import { useBranchId } from './inventory/InventoryShared';

// const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition';
// const labelCls = 'text-xs text-zinc-400 block mb-1.5 font-semibold tracking-wide uppercase';

// export default function ClassesPage() {
//   const getBranchId = useBranchId();
//   const branchId = getBranchId() || '4';

//   // Current Logged-in User Context
//   let currentUser = null;
//   try {
//     const raw = localStorage.getItem('gym_user');
//     if (raw) currentUser = JSON.parse(raw);
//   } catch (e) {
//     currentUser = null;
//   }

//   const currentRole = (currentUser?.role || currentUser?.role_slug || 'trainer').toLowerCase().trim();
//   const isSuper = Boolean(currentUser?.isSuperAdmin || currentUser?.is_super_admin);
//   const isManagement = isSuper || currentRole === 'owner' || currentRole === 'manager';
//   const isReception = currentRole === 'receptionist';
//   const canManageBookings = isManagement || isReception;

//   const [classes, setClasses] = useState([]);
//   const [schedules, setSchedules] = useState([]);
//   const [trainers, setTrainers] = useState([]);
//   const [members, setMembers] = useState([]);
//   const [loading, setLoading] = useState(true);

//   // Modals
//   const [showClassModal, setShowClassModal] = useState(false);
//   const [showScheduleModal, setShowScheduleModal] = useState(false);
//   const [showBookingModal, setShowBookingModal] = useState(false);
//   const [selectedSchedule, setSelectedSchedule] = useState(null);

//   // Forms
//   const [classForm, setClassForm] = useState({
//     name: '',
//     description: '',
//     max_capacity: 20,
//     duration_minutes: 60,
//     price: '500.00',
//   });

//   const [scheduleForm, setScheduleForm] = useState({
//     class_id: '',
//     trainer_user_id: '',
//     start_date: new Date().toISOString().split('T')[0],
//     start_time: '07:00',
//     end_time: '08:00',
//   });

//   const [selectedMemberId, setSelectedMemberId] = useState('');
//   const [submitting, setSubmitting] = useState(false);
//   const [message, setMessage] = useState({ type: '', text: '' });

//   // ─── Fetch Data ───
//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const bParam = branchId ? `?branch_id=${parseInt(branchId, 10)}` : '';
//       const promises = [
//         apiGet(`/api/v1/classes${bParam}`).catch(() => ({ success: false, data: [] })),
//         apiGet(`/api/v1/classes/schedules${bParam}`).catch(() => ({ success: false, data: [] })),
//       ];

//       // Staff aur Member lists sirf booking & scheduling roles ko load karni hain
//       if (canManageBookings) {
//         promises.push(apiGet('/api/v1/staff').catch(() => ({ success: false, data: [] })));
//         promises.push(apiGet('/api/v1/members?limit=1000').catch(() => ({ success: false, data: [] })));
//       }

//       const [clsRes, schRes, staffRes, memRes] = await Promise.all(promises);

//       if (clsRes?.success) setClasses(clsRes.data || []);
//       if (schRes?.success) setSchedules(schRes.data || []);
//       if (staffRes?.success) setTrainers(staffRes.data || []);
//       if (memRes?.success) setMembers(memRes.data || []);
//     } catch (err) {
//       console.error('Failed to load class data:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, [branchId, canManageBookings]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   // 1. Create Class (Only Owner / Manager)
//   const handleCreateClass = async (e) => {
//     e.preventDefault();
//     if (!isManagement) return;
//     setSubmitting(true);
//     setMessage({ type: '', text: '' });
//     const res = await apiPost('/api/v1/classes', {
//       ...classForm,
//       branch_id: parseInt(branchId, 10),
//       price: parseFloat(classForm.price || 0),
//     });
//     if (res?.success) {
//       setMessage({ type: 'success', text: `"${classForm.name}" class register ho gayi!` });
//       setShowClassModal(false);
//       setClassForm({ name: '', description: '', max_capacity: 20, duration_minutes: 60, price: '500.00' });
//       fetchData();
//     } else {
//       setMessage({ type: 'error', text: res?.message || 'Class create karne mein error.' });
//     }
//     setSubmitting(false);
//   };

//   // 2. Schedule Slot (Owner, Manager, Receptionist)
//   const handleScheduleClass = async (e) => {
//     e.preventDefault();
//     if (!canManageBookings) return;
//     setSubmitting(true);
//     setMessage({ type: '', text: '' });
//     const startDateTime = `${scheduleForm.start_date}T${scheduleForm.start_time}:00`;
//     const endDateTime = `${scheduleForm.start_date}T${scheduleForm.end_time}:00`;
//     const res = await apiPost('/api/v1/classes/schedule', {
//       class_id: parseInt(scheduleForm.class_id, 10),
//       trainer_user_id: scheduleForm.trainer_user_id ? parseInt(scheduleForm.trainer_user_id, 10) : null,
//       start_time: startDateTime,
//       end_time: endDateTime,
//     });
//     if (res?.success) {
//       setMessage({ type: 'success', text: 'Class batch slot successfully schedule ho gaya!' });
//       setShowScheduleModal(false);
//       fetchData();
//     } else {
//       setMessage({ type: 'error', text: res?.message || 'Schedule publish karne me error.' });
//     }
//     setSubmitting(false);
//   };

//   // 3. Book Member Slot
//   const handleBookMember = async (e) => {
//     e.preventDefault();
//     if (!canManageBookings || !selectedSchedule || !selectedMemberId) return;
//     setSubmitting(true);
//     setMessage({ type: '', text: '' });
//     const res = await apiPost('/api/v1/classes/book', {
//       class_schedule_id: selectedSchedule.id,
//       member_id: parseInt(selectedMemberId, 10),
//     });
//     if (res?.success) {
//       setMessage({ type: 'success', text: res.message || 'Slot successfully booked!' });
//       setShowBookingModal(false);
//       setSelectedMemberId('');
//       fetchData();
//     } else {
//       setMessage({ type: 'error', text: res?.message || 'Booking nahi ho saki.' });
//     }
//     setSubmitting(false);
//   };

//   // 4. Cancel Booking
//   const handleCancelBooking = async (bookingId) => {
//     if (!canManageBookings) return;
//     if (!window.confirm('Kya aap sure hain ki is booking ko cancel karna chahte hain?')) return;
//     const res = await apiPost('/api/v1/classes/cancel', { booking_id: bookingId });
//     if (res?.success) {
//       setMessage({ type: 'success', text: res.message });
//       fetchData();
//     } else {
//       setMessage({ type: 'error', text: res?.message || 'Cancel karne me issue aaya.' });
//     }
//   };

//   return (
//     <div className="max-w-7xl mx-auto space-y-6 pb-16">
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
//         <div>
//           <div className="flex items-center gap-2">
//             <h1 className="text-2xl font-bold text-white tracking-wide">Studio Fitness Classes & Schedule</h1>
//             <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-zinc-950 border border-zinc-800 text-lime-400">
//               {currentRole} view
//             </span>
//           </div>
//           <p className="text-sm text-zinc-400 mt-0.5">
//             {currentRole === 'trainer'
//               ? 'Studio class batches, registered attendees list, aur session timing schedule.'
//               : 'Zumba, Yoga, HIIT, Crossfit sessions manage karein with real-time capacity and auto-waitlist engine.'}
//           </p>
//         </div>

//         {/* 🔒 SIRF MANAGEMENT / RECEPTION KO ACTION BUTTONS DIKHENGE */}
//         {canManageBookings && (
//           <div className="flex gap-2.5">
//             {isManagement && (
//               <button
//                 onClick={() => setShowClassModal(true)}
//                 className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold rounded-xl transition"
//               >
//                 + Create Class Master
//               </button>
//             )}
//             <button
//               onClick={() => setShowScheduleModal(true)}
//               disabled={classes.length === 0}
//               className="px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-40 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
//             >
//               🗓️ Schedule Batch Slot
//             </button>
//           </div>
//         )}
//       </div>

//       {/* Feedback Alert */}
//       {message.text && (
//         <div
//           className={`p-4 rounded-xl text-xs font-bold border flex justify-between items-center ${
//             message.type === 'success'
//               ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
//               : 'bg-red-500/10 text-red-400 border-red-500/30'
//           }`}
//         >
//           <span>{message.text}</span>
//           <button onClick={() => setMessage({ type: '', text: '' })} className="hover:underline">✕</button>
//         </div>
//       )}

//       {/* Active Schedules Cards */}
//       <div className="space-y-4">
//         <div className="flex justify-between items-center">
//           <h3 className="text-sm font-bold text-white uppercase tracking-wider">
//             {currentRole === 'trainer' ? 'Scheduled Studio Sessions' : 'Upcoming Batch Slots'}
//           </h3>
//           <span className="text-xs text-zinc-500 font-mono">{schedules.length} Batches Active</span>
//         </div>

//         {loading ? (
//           <div className="py-20 text-center text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs">
//             Loading batch schedules & rosters...
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
//             {schedules.map((sch) => {
//               const booked = parseInt(sch.booked_count || 0, 10);
//               const max = parseInt(sch.max_capacity || 20, 10);
//               const isFull = booked >= max;
//               const waitlistCount = parseInt(sch.waitlist_count || 0, 10);
//               const percent = Math.min(100, Math.round((booked / max) * 100));
//               const classFee = parseFloat(sch.class_price !== undefined ? sch.class_price : 0);
//               const startTimeFormatted = new Date(sch.start_time).toLocaleTimeString('en-IN', {
//                 hour: '2-digit',
//                 minute: '2-digit',
//               });
//               const endTimeFormatted = new Date(sch.end_time).toLocaleTimeString('en-IN', {
//                 hour: '2-digit',
//                 minute: '2-digit',
//               });

//               return (
//                 <div
//                   key={sch.id}
//                   className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xl"
//                 >
//                   <div>
//                     <div className="flex justify-between items-start gap-2">
//                       <div>
//                         <div className="flex items-center gap-2">
//                           <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-lime-400">
//                             {sch.duration_minutes} Mins Session
//                           </span>
//                           <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
//                             {classFee > 0 ? `₹${classFee.toFixed(2)} / Pass` : 'FREE / Membership'}
//                           </span>
//                         </div>
//                         <h4 className="text-lg font-bold text-white mt-1">{sch.class_name}</h4>
//                         <p className="text-xs text-zinc-400">
//                           Trainer: <strong className="text-zinc-200">{sch.trainer_name || 'Coach Assigned'}</strong>
//                         </p>
//                       </div>
//                       <span
//                         className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${
//                           isFull
//                             ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
//                             : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
//                         }`}
//                       >
//                         {isFull ? `Waitlist (${waitlistCount})` : 'Open'}
//                       </span>
//                     </div>

//                     <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs flex justify-between items-center font-mono">
//                       <div>
//                         <span className="text-[10px] text-zinc-500 block uppercase">Date</span>
//                         <strong className="text-white">{new Date(sch.start_time).toLocaleDateString('en-IN')}</strong>
//                       </div>
//                       <div className="text-right">
//                         <span className="text-[10px] text-zinc-500 block uppercase">Time Slot</span>
//                         <strong className="text-lime-400">{startTimeFormatted} - {endTimeFormatted}</strong>
//                       </div>
//                     </div>

//                     {/* Capacity Progress Bar */}
//                     <div className="mt-4 space-y-1.5">
//                       <div className="flex justify-between text-[11px] font-mono">
//                         <span className="text-zinc-400">Registered Headcount</span>
//                         <span className={isFull ? 'text-amber-400 font-bold' : 'text-zinc-200'}>
//                           {booked} / {max} Slots ({percent}%)
//                         </span>
//                       </div>
//                       <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
//                         <div
//                           className={`h-full transition-all duration-300 ${
//                             isFull ? 'bg-amber-400' : 'bg-lime-400'
//                           }`}
//                           style={{ width: `${percent}%` }}
//                         />
//                       </div>
//                     </div>

//                     {/* Booked Attendees Roster */}
//                     {sch.bookings?.length > 0 && (
//                       <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-1.5">
//                         <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
//                           Confirmed Attendees ({sch.bookings.length})
//                         </span>
//                         <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
//                           {sch.bookings.map((b) => (
//                             <div
//                               key={b.booking_id}
//                               className="flex justify-between items-center bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-[11px]"
//                             >
//                               <span className="text-zinc-200 font-medium truncate max-w-[200px]">
//                                 {b.member_name} <span className="text-zinc-500 font-mono text-[9px]">({b.member_code})</span>
//                               </span>

//                               {/* Cancel button sirf Desk ya Management ko dikhega */}
//                               {canManageBookings && (
//                                 <button
//                                   onClick={() => handleCancelBooking(b.booking_id)}
//                                   className="text-zinc-500 hover:text-red-400 font-bold text-[10px] transition"
//                                   title="Cancel slot"
//                                 >
//                                   ✕
//                                 </button>
//                               )}
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                   </div>

//                   {/* 🔒 BOOKING ACTION BUTTON (Sirf Desk / Management) */}
//                   {canManageBookings && (
//                     <div className="pt-3 border-t border-zinc-800">
//                       <button
//                         onClick={() => {
//                           setSelectedSchedule(sch);
//                           setShowBookingModal(true);
//                         }}
//                         className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex justify-center items-center gap-1.5 shadow-sm ${
//                           isFull
//                             ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 font-extrabold'
//                             : 'bg-lime-400 hover:bg-lime-300 text-zinc-950'
//                         }`}
//                       >
//                         {isFull ? `⚠️ Add to Waitlist (Pos #${waitlistCount + 1})` : '🎟️ Book Member In Slot'}
//                       </button>
//                     </div>
//                   )}
//                 </div>
//               );
//             })}

//             {schedules.length === 0 && (
//               <div className="col-span-full py-20 text-center text-zinc-500 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl text-xs space-y-2">
//                 <span className="text-3xl block">🗓️</span>
//                 <p className="font-semibold text-zinc-300">Koi class batch schedule nahi hai.</p>
//                 <p className="text-zinc-600">
//                   {canManageBookings
//                     ? 'Upar "Schedule Batch Slot" par click karke naya time slot publish karein.'
//                     : 'Gym management jab naya schedule publish karegi tab yahan show hoga.'}
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* ─── MODAL 1: CREATE MASTER CLASS (Management Only) ─── */}
//       {showClassModal && isManagement && (
//         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
//           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in">
//             <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
//               <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create New Group Class Master</h3>
//               <button onClick={() => setShowClassModal(false)} className="text-zinc-500 hover:text-white">✕</button>
//             </div>
//             <form onSubmit={handleCreateClass} className="space-y-4">
//               <div>
//                 <label className={labelCls}>Class Title *</label>
//                 <input
//                   type="text"
//                   required
//                   placeholder="e.g. Power Yoga, Morning HIIT, Zumba Beat"
//                   value={classForm.name}
//                   onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
//                   className={inputCls}
//                 />
//               </div>
//               <div>
//                 <label className={labelCls}>Description (Optional)</label>
//                 <textarea
//                   rows="2"
//                   placeholder="Workout details, intensity, equipment required..."
//                   value={classForm.description}
//                   onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
//                   className={inputCls}
//                 />
//               </div>
//               <div className="grid grid-cols-3 gap-3">
//                 <div>
//                   <label className={labelCls}>Max Seats *</label>
//                   <input
//                     type="number"
//                     min="1"
//                     required
//                     value={classForm.max_capacity}
//                     onChange={(e) => setClassForm({ ...classForm, max_capacity: e.target.value })}
//                     className={inputCls}
//                   />
//                 </div>
//                 <div>
//                   <label className={labelCls}>Mins *</label>
//                   <input
//                     type="number"
//                     min="15"
//                     step="5"
//                     required
//                     value={classForm.duration_minutes}
//                     onChange={(e) => setClassForm({ ...classForm, duration_minutes: e.target.value })}
//                     className={inputCls}
//                   />
//                 </div>
//                 <div>
//                   <label className={labelCls}>Pass Fee (₹) *</label>
//                   <input
//                     type="number"
//                     min="0"
//                     step="0.01"
//                     required
//                     placeholder="500.00"
//                     value={classForm.price}
//                     onChange={(e) => setClassForm({ ...classForm, price: e.target.value })}
//                     className={inputCls}
//                   />
//                 </div>
//               </div>
//               <button
//                 type="submit"
//                 disabled={submitting}
//                 className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2"
//               >
//                 {submitting ? 'Registering...' : 'Save Class Master'}
//               </button>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ─── MODAL 2: SCHEDULE BATCH SLOT (Desk / Management) ─── */}
//       {showScheduleModal && canManageBookings && (
//         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
//           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in">
//             <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
//               <h3 className="text-sm font-bold text-white uppercase tracking-wider">Publish Batch Slot</h3>
//               <button onClick={() => setShowScheduleModal(false)} className="text-zinc-500 hover:text-white">✕</button>
//             </div>
//             <form onSubmit={handleScheduleClass} className="space-y-4">
//               <div>
//                 <label className={labelCls}>Select Class *</label>
//                 <select
//                   required
//                   value={scheduleForm.class_id}
//                   onChange={(e) => setScheduleForm({ ...scheduleForm, class_id: e.target.value })}
//                   className={inputCls}
//                 >
//                   <option value="">-- Choose Class --</option>
//                   {classes.map((c) => (
//                     <option key={c.id} value={c.id}>
//                       {c.name} (Max {c.max_capacity} Seats • {c.duration_minutes}m • ₹{parseFloat(c.price || 0).toFixed(2)})
//                     </option>
//                   ))}
//                 </select>
//               </div>
//               <div>
//                 <label className={labelCls}>Assign Trainer / Coach</label>
//                 <select
//                   value={scheduleForm.trainer_user_id}
//                   onChange={(e) => setScheduleForm({ ...scheduleForm, trainer_user_id: e.target.value })}
//                   className={inputCls}
//                 >
//                   <option value="">-- Select Coach (Optional) --</option>
//                   {trainers.map((t) => (
//                     <option key={t.user_id || t.id} value={t.user_id || t.id}>
//                       {t.name || t.employee_code} ({t.designation || 'Trainer'})
//                     </option>
//                   ))}
//                 </select>
//               </div>
//               <div>
//                 <label className={labelCls}>Session Date *</label>
//                 <input
//                   type="date"
//                   required
//                   value={scheduleForm.start_date}
//                   onChange={(e) => setScheduleForm({ ...scheduleForm, start_date: e.target.value })}
//                   className={inputCls}
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-3">
//                 <div>
//                   <label className={labelCls}>Start Time *</label>
//                   <input
//                     type="time"
//                     required
//                     value={scheduleForm.start_time}
//                     onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
//                     className={inputCls}
//                   />
//                 </div>
//                 <div>
//                   <label className={labelCls}>End Time *</label>
//                   <input
//                     type="time"
//                     required
//                     value={scheduleForm.end_time}
//                     onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
//                     className={inputCls}
//                   />
//                 </div>
//               </div>
//               <button
//                 type="submit"
//                 disabled={submitting}
//                 className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2"
//               >
//                 {submitting ? 'Publishing...' : 'Publish Schedule'}
//               </button>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ─── MODAL 3: BOOK MEMBER IN BATCH (Desk / Management) ─── */}
//       {showBookingModal && canManageBookings && selectedSchedule && (
//         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
//           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in">
//             <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
//               <div>
//                 <h3 className="text-sm font-bold text-white">Book Slot: {selectedSchedule.class_name}</h3>
//                 <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
//                   Time: {new Date(selectedSchedule.start_time).toLocaleDateString('en-IN')}
//                 </p>
//               </div>
//               <button onClick={() => setShowBookingModal(false)} className="text-zinc-500 hover:text-white">✕</button>
//             </div>
//             <form onSubmit={handleBookMember} className="space-y-4">
//               <div>
//                 <label className={labelCls}>Select Gym Member *</label>
//                 <select
//                   required
//                   value={selectedMemberId}
//                   onChange={(e) => setSelectedMemberId(e.target.value)}
//                   className={inputCls}
//                 >
//                   <option value="">-- Choose Member --</option>
//                   {members.map((m) => (
//                     <option key={m.id} value={m.id}>
//                       {m.member_code} — {m.first_name} {m.last_name || ''} ({m.phone})
//                     </option>
//                   ))}
//                 </select>
//               </div>
//               <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-1">
//                 <div className="flex justify-between text-zinc-400">
//                   <span>Current Bookings:</span>
//                   <span className="font-mono text-white font-bold">{selectedSchedule.booked_count} / {selectedSchedule.max_capacity}</span>
//                 </div>
//                 {parseInt(selectedSchedule.booked_count, 10) >= parseInt(selectedSchedule.max_capacity, 10) && (
//                   <p className="text-amber-400 font-semibold text-[11px] pt-1 border-t border-zinc-800 mt-2">
//                     ⚡ Capacity full ho chuki hai. Yeh booking Waitlist position #{parseInt(selectedSchedule.waitlist_count || 0, 10) + 1} par jayegi!
//                   </p>
//                 )}
//               </div>
//               <button
//                 type="submit"
//                 disabled={submitting}
//                 className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
//               >
//                 {submitting ? 'Confirming...' : 'Confirm Class Booking'}
//               </button>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, API_BASE_URL } from '../api';
import { useBranchId } from './inventory/InventoryShared';

const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition';
const labelCls = 'text-xs text-zinc-400 block mb-1.5 font-semibold tracking-wide uppercase';

export default function ClassesPage() {
  const navigate = useNavigate();
  const getBranchId = useBranchId();
  const branchId = getBranchId() || '4';

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
  const canManageBookings = isManagement || isReception;

  const [classes, setClasses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Forms
  const [classForm, setClassForm] = useState({
    name: '',
    description: '',
    max_capacity: 20,
    duration_minutes: 60,
    price: '500.00',
  });

  const [scheduleForm, setScheduleForm] = useState({
    class_id: '',
    trainer_user_id: '',
    start_date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '08:00',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const getFullImageUrl = (url) => {
    if (!url || typeof url !== 'string' || !url.trim()) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const cleanBase = API_BASE_URL.replace(/\/$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanUrl}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = branchId ? `?branch_id=${parseInt(branchId, 10)}` : '';
      const promises = [
        apiGet(`/api/v1/classes${bParam}`).catch(() => ({ success: false, data: [] })),
        apiGet(`/api/v1/classes/schedules${bParam}`).catch(() => ({ success: false, data: [] })),
      ];

      if (canManageBookings) {
        promises.push(apiGet('/api/v1/staff').catch(() => ({ success: false, data: [] })));
      }

      const [clsRes, schRes, staffRes] = await Promise.all(promises);

      if (clsRes?.success) setClasses(clsRes.data || []);
      if (schRes?.success) setSchedules(schRes.data || []);
      if (staffRes?.success) setTrainers(staffRes.data || []);
    } catch (err) {
      console.error('Failed to load class data:', err);
    } finally {
      setLoading(false);
    }
  }, [branchId, canManageBookings]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!isManagement) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    const res = await apiPost('/api/v1/classes', {
      ...classForm,
      branch_id: parseInt(branchId, 10),
      price: parseFloat(classForm.price || 0),
    });
    if (res?.success) {
      setMessage({ type: 'success', text: `"${classForm.name}" class register ho gayi!` });
      setShowClassModal(false);
      setClassForm({ name: '', description: '', max_capacity: 20, duration_minutes: 60, price: '500.00' });
      fetchData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Class create karne mein error.' });
    }
    setSubmitting(false);
  };

  const handleScheduleClass = async (e) => {
    e.preventDefault();
    if (!canManageBookings) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    const startDateTime = `${scheduleForm.start_date}T${scheduleForm.start_time}:00`;
    const endDateTime = `${scheduleForm.start_date}T${scheduleForm.end_time}:00`;
    const res = await apiPost('/api/v1/classes/schedule', {
      class_id: parseInt(scheduleForm.class_id, 10),
      trainer_user_id: scheduleForm.trainer_user_id ? parseInt(scheduleForm.trainer_user_id, 10) : null,
      start_time: startDateTime,
      end_time: endDateTime,
    });
    if (res?.success) {
      setMessage({ type: 'success', text: 'Class batch slot successfully schedule ho gaya!' });
      setShowScheduleModal(false);
      fetchData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Schedule publish karne me error.' });
    }
    setSubmitting(false);
  };

  const handleCancelBooking = async (bookingId) => {
    if (!canManageBookings) return;
    if (!window.confirm('Kya aap sure hain ki is booking ko cancel karna chahte hain?')) return;
    const res = await apiPost('/api/v1/classes/cancel', { booking_id: bookingId });
    if (res?.success) {
      setMessage({ type: 'success', text: res.message });
      fetchData();
    } else {
      setMessage({ type: 'error', text: res?.message || 'Cancel karne me issue aaya.' });
    }
  };

  // 🔥 PROFESSIONAL WORKFLOW: Redirect to Billing POS with Class & Schedule Pre-filled
  const handleRedirectToBilling = (sch) => {
    navigate(
      `/billing/create-invoice?type=class&schedule_id=${sch.id}&class_id=${sch.class_id}&amount=${sch.class_price}&class_name=${encodeURIComponent(sch.class_name)}`
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-wide">Studio Fitness Classes & Batches</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-zinc-950 border border-zinc-800 text-lime-400">
              {currentRole} view
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">
            Real-time batch booking with automatic POS invoice sync and waitlist queue management.
          </p>
        </div>

        {canManageBookings && (
          <div className="flex gap-2.5">
            {isManagement && (
              <button
                onClick={() => setShowClassModal(true)}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold rounded-xl transition"
              >
                + Create Class Master
              </button>
            )}
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={classes.length === 0}
              className="px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-40 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
            >
              🗓️ Schedule Batch Slot
            </button>
          </div>
        )}
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border flex justify-between items-center ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="hover:underline">✕</button>
        </div>
      )}

      {/* Active Schedules Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {currentRole === 'trainer' ? 'My Assigned Studio Sessions' : 'Upcoming Batch Slots'}
          </h3>
          <span className="text-xs text-zinc-500 font-mono">{schedules.length} Batches Active</span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs">
            Loading batch schedules & rosters...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {schedules.map((sch) => {
              const booked = parseInt(sch.booked_count || 0, 10);
              const max = parseInt(sch.max_capacity || 20, 10);
              const isFull = booked >= max;
              const waitlistCount = parseInt(sch.waitlist_count || 0, 10);
              const percent = Math.min(100, Math.round((booked / max) * 100));
              const classFee = parseFloat(sch.class_price !== undefined ? sch.class_price : 0);
              const startTimeFormatted = new Date(sch.start_time).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endTimeFormatted = new Date(sch.end_time).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={sch.id}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-lime-400">
                            {sch.duration_minutes} Mins
                          </span>
                          <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                            {classFee > 0 ? `₹${classFee.toFixed(2)}` : 'FREE / Membership'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white mt-1">{sch.class_name}</h4>
                        <p className="text-xs text-zinc-400">
                          Coach: <strong className="text-zinc-200">{sch.trainer_name || 'Coach Assigned'}</strong>
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${
                          isFull
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {isFull ? `Waitlist (${waitlistCount})` : 'Open'}
                      </span>
                    </div>

                    <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs flex justify-between items-center font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-500 block uppercase">Date</span>
                        <strong className="text-white">{new Date(sch.start_time).toLocaleDateString('en-IN')}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block uppercase">Timing</span>
                        <strong className="text-lime-400">{startTimeFormatted} - {endTimeFormatted}</strong>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-zinc-400">Enrolled Headcount</span>
                        <span className={isFull ? 'text-amber-400 font-bold' : 'text-zinc-200'}>
                          {booked} / {max} Slots ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className={`h-full transition-all duration-300 ${isFull ? 'bg-amber-400' : 'bg-lime-400'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Confirmed Attendees List */}
                    {sch.bookings?.length > 0 ? (
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-2">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
                          Confirmed Attendees ({sch.bookings.length})
                        </span>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {sch.bookings.map((b) => {
                            const photo = getFullImageUrl(b.profile_image_url);
                            return (
                              <div
                                key={b.booking_id}
                                className="flex justify-between items-center bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800 text-[11px]"
                              >
                                <div className="flex items-center gap-2">
                                  {photo ? (
                                    <img
                                      src={photo}
                                      alt=""
                                      className="w-6 h-6 rounded-full object-cover border border-lime-400/50"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-lime-400">
                                      {b.member_name?.[0] || 'M'}
                                    </div>
                                  )}
                                  <div>
                                    <span
                                      onClick={() => b.member_hash_id && navigate(`/members/${b.member_hash_id}`)}
                                      className="text-zinc-200 font-semibold hover:text-lime-400 cursor-pointer block leading-none"
                                    >
                                      {b.member_name}
                                    </span>
                                    <span className="text-[9px] text-zinc-500 font-mono">
                                      {b.member_code} {b.invoice_number ? `• Bill: ${b.invoice_number}` : ''}
                                    </span>
                                  </div>
                                </div>

                                {canManageBookings && (
                                  <button
                                    onClick={() => handleCancelBooking(b.booking_id)}
                                    className="text-zinc-500 hover:text-red-400 font-bold text-xs transition px-1"
                                    title="Cancel booking"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 text-center py-2">
                        Koi member abhi booked nahi hai.
                      </div>
                    )}
                  </div>

                  {/* 🔒 PROFESSIONAL REDIRECT TO BILLING POS */}
                  {canManageBookings && (
                    <div className="pt-3 border-t border-zinc-800">
                      <button
                        onClick={() => handleRedirectToBilling(sch)}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex justify-center items-center gap-1.5 shadow-sm ${
                          isFull
                            ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 font-extrabold'
                            : 'bg-lime-400 hover:bg-lime-300 text-zinc-950'
                        }`}
                      >
                        {isFull
                          ? `⚠️ Bill & Add To Waitlist (#${waitlistCount + 1})`
                          : '💳 Bill & Book Slot at Desk →'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {schedules.length === 0 && (
              <div className="col-span-full py-20 text-center text-zinc-500 bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl text-xs space-y-2">
                <span className="text-3xl block">🗓️</span>
                <p className="font-semibold text-zinc-300">Koi class batch schedule nahi hai.</p>
                <p className="text-zinc-600">
                  {canManageBookings
                    ? 'Upar "Schedule Batch Slot" par click karke naya time slot publish karein.'
                    : 'Gym management jab naya schedule publish karegi tab yahan show hoga.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE MASTER CLASS */}
      {showClassModal && isManagement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create New Group Class Master</h3>
              <button onClick={() => setShowClassModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className={labelCls}>Class Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Power Yoga, Morning HIIT, Zumba Beat"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Workout details, intensity, equipment required..."
                  value={classForm.description}
                  onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Max Seats *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={classForm.max_capacity}
                    onChange={(e) => setClassForm({ ...classForm, max_capacity: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mins *</label>
                  <input
                    type="number"
                    min="15"
                    step="5"
                    required
                    value={classForm.duration_minutes}
                    onChange={(e) => setClassForm({ ...classForm, duration_minutes: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Pass Fee (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="500.00"
                    value={classForm.price}
                    onChange={(e) => setClassForm({ ...classForm, price: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2"
              >
                {submitting ? 'Registering...' : 'Save Class Master'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE BATCH SLOT */}
      {showScheduleModal && canManageBookings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Publish Batch Slot</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleScheduleClass} className="space-y-4">
              <div>
                <label className={labelCls}>Select Class *</label>
                <select
                  required
                  value={scheduleForm.class_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, class_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Choose Class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Max {c.max_capacity} Seats • {c.duration_minutes}m • ₹{parseFloat(c.price || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Assign Trainer / Coach</label>
                <select
                  value={scheduleForm.trainer_user_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, trainer_user_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Select Coach (Optional) --</option>
                  {trainers.map((t) => (
                    <option key={t.user_id || t.id} value={t.user_id || t.id}>
                      {t.name || t.employee_code} ({t.designation || 'Trainer'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Session Date *</label>
                <input
                  type="date"
                  required
                  value={scheduleForm.start_date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, start_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Time *</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>End Time *</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 mt-2"
              >
                {submitting ? 'Publishing...' : 'Publish Schedule'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}