// import React, { useState, useEffect, useCallback } from 'react';
// import { apiGet, apiPost, apiPut, apiDelete } from '../api';
// import { useBranch } from '../context/BranchContext';

// export default function BranchesPage() {
//   const { activeBranch, switchBranch, refreshBranches } = useBranch();
//   const [branches, setBranches] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [showModal, setShowModal] = useState(false);
//   const [editingBranch, setEditingBranch] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [errorMsg, setErrorMsg] = useState('');

//   const initialForm = {
//     name: '',
//     code: '',
//     phone: '',
//     email: '',
//     address_line1: '',
//     city: '',
//     state: '',
//     pincode: '',
//     opening_time: '06:00',
//     closing_time: '22:00'
//   };
//   const [formData, setFormData] = useState(initialForm);

//   const fetchBranchesList = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await apiGet('/api/v1/branches');
//       if (res?.success) {
//         setBranches(res.data || []);
//       }
//     } catch (err) {
//       console.error('Failed to load branches:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchBranchesList();
//   }, [fetchBranchesList]);

//   const handleOpenCreateModal = () => {
//     setEditingBranch(null);
//     setFormData(initialForm);
//     setErrorMsg('');
//     setShowModal(true);
//   };

//   const handleOpenEditModal = (branch) => {
//     setEditingBranch(branch);
//     setFormData({
//       name: branch.name || '',
//       code: branch.code || '',
//       phone: branch.phone || '',
//       email: branch.email || '',
//       address_line1: branch.address_line1 || '',
//       city: branch.city || '',
//       state: branch.state || '',
//       pincode: branch.pincode || '',
//       opening_time: branch.opening_time || '06:00',
//       closing_time: branch.closing_time || '22:00'
//     });
//     setErrorMsg('');
//     setShowModal(true);
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setErrorMsg('');

//     if (!formData.name || !formData.code) {
//       setErrorMsg('Branch Name aur Unique Code mandatory hain.');
//       return;
//     }

//     setSubmitting(true);
//     try {
//       let res;
//       if (editingBranch) {
//         res = await apiPut(`/api/v1/branches/${editingBranch.id}`, formData);
//       } else {
//         res = await apiPost('/api/v1/branches', formData);
//       }

//       if (res?.success) {
//         setShowModal(false);
//         setFormData(initialForm);
//         fetchBranchesList();
//         refreshBranches();
//       } else {
//         setErrorMsg(res?.message || 'Branch process karne me error aayi.');
//       }
//     } catch (err) {
//       setErrorMsg('Network request fail ho gaya.');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleDelete = async (branch) => {
//     if (!window.confirm(`Kya aap sach me Branch '${branch.name}' ko remove karna chahte hain?`)) return;

//     const res = await apiDelete(`/api/v1/branches/${branch.id}`);
//     if (res?.success) {
//       fetchBranchesList();
//       refreshBranches();
//     } else {
//       alert(res?.message || 'Delete karne me dikkat aayi.');
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
//         <div>
//           <h2 className="text-xl font-bold text-white tracking-tight">Multi-Branch Locations</h2>
//           <p className="text-sm text-zinc-400 mt-1">
//             Apni gym franchise aur branch operations ek hi dashboard se control karein.
//           </p>
//         </div>
//         <button
//           onClick={handleOpenCreateModal}
//           className="px-5 py-2.5 bg-lime-400 text-zinc-950 font-bold text-sm rounded-xl hover:bg-lime-300 transition"
//         >
//           + Add New Branch
//         </button>
//       </div>

//       {/* Grid */}
//       {loading ? (
//         <div className="text-center py-20 text-zinc-500">Loading branch networks...</div>
//       ) : (
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
//           {branches.map((b) => {
//             const isCurrentlyActive = activeBranch?.id === b.id;

//             return (
//               <div
//                 key={b.id}
//                 className={`bg-zinc-900 border rounded-2xl p-6 flex flex-col justify-between transition ${
//                   isCurrentlyActive ? 'border-lime-400/50 ring-1 ring-lime-400/20' : 'border-zinc-800 hover:border-zinc-700'
//                 }`}
//               >
//                 <div>
//                   <div className="flex justify-between items-start mb-3">
//                     <div>
//                       <h3 className="text-lg font-bold text-white">{b.name}</h3>
//                       <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
//                         CODE: {b.code}
//                       </span>
//                     </div>
//                     {isCurrentlyActive ? (
//                       <span className="text-xs bg-lime-400/10 text-lime-400 border border-lime-400/20 px-2.5 py-1 rounded-full font-semibold">
//                         Current Active
//                       </span>
//                     ) : (
//                       <button
//                         onClick={() => switchBranch(b.id)}
//                         className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full font-medium transition"
//                       >
//                         Switch To ↗
//                       </button>
//                     )}
//                   </div>

//                   <div className="space-y-1.5 text-xs text-zinc-400 mt-4">
//                     <p>📍 {b.address_line1 ? `${b.address_line1}, ${b.city || ''}` : 'Location details not set'}</p>
//                     <p>📞 {b.phone || 'Phone not set'}</p>
//                     <p>⏰ {b.opening_time || '06:00'} - {b.closing_time || '22:00'}</p>
//                     <p className="text-zinc-300 font-medium pt-2">
//                       👥 Active Members: <span className="text-white font-bold">{b.active_members_count || 0}</span>
//                     </p>
//                   </div>
//                 </div>

//                 <div className="mt-6 pt-4 border-t border-zinc-800/60 flex justify-between items-center text-xs">
//                   <div className="flex gap-2">
//                     <button
//                       onClick={() => handleOpenEditModal(b)}
//                       className="text-zinc-400 hover:text-white font-medium"
//                     >
//                       Edit
//                     </button>
//                     <span className="text-zinc-700">|</span>
//                     <button
//                       onClick={() => handleDelete(b)}
//                       className="text-red-400 hover:text-red-300 font-medium"
//                     >
//                       Delete
//                     </button>
//                   </div>
//                   <span className={`px-2 py-0.5 rounded text-[11px] ${b.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
//                     {b.is_active ? 'Operational' : 'Inactive'}
//                   </span>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       )}

//       {/* Modal */}
//       {showModal && (
//         <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
//           <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
//             <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-800">
//               <h3 className="text-lg font-bold text-white">
//                 {editingBranch ? 'Edit Branch Details' : 'Register New Branch'}
//               </h3>
//               <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white text-lg">
//                 ✕
//               </button>
//             </div>

//             {errorMsg && (
//               <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
//                 ⚠️ {errorMsg}
//               </div>
//             )}

//             <form onSubmit={handleSubmit} className="space-y-4">
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">Branch Name *</label>
//                   <input
//                     type="text"
//                     required
//                     placeholder="e.g. Malviya Nagar Hub"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.name}
//                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">Branch Code (Unique) *</label>
//                   <input
//                     type="text"
//                     required
//                     placeholder="e.g. MN-02"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white uppercase outline-none focus:border-lime-400"
//                     value={formData.code}
//                     onChange={(e) => setFormData({ ...formData, code: e.target.value })}
//                   />
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">Official Phone</label>
//                   <input
//                     type="tel"
//                     placeholder="9876543210"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.phone}
//                     onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">Official Email</label>
//                   <input
//                     type="email"
//                     placeholder="branch@gym.com"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.email}
//                     onChange={(e) => setFormData({ ...formData, email: e.target.value })}
//                   />
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-xs text-zinc-400 mb-1">Address Line</label>
//                 <input
//                   type="text"
//                   placeholder="Street / Plaza address"
//                   className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                   value={formData.address_line1}
//                   onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
//                 />
//               </div>

//               <div className="grid grid-cols-3 gap-3">
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">City</label>
//                   <input
//                     type="text"
//                     placeholder="Jaipur"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.city}
//                     onChange={(e) => setFormData({ ...formData, city: e.target.value })}
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">State</label>
//                   <input
//                     type="text"
//                     placeholder="Rajasthan"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.state}
//                     onChange={(e) => setFormData({ ...formData, state: e.target.value })}
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">Pincode</label>
//                   <input
//                     type="text"
//                     placeholder="302017"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.pincode}
//                     onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
//                   />
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">Opening Time</label>
//                   <input
//                     type="time"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.opening_time}
//                     onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs text-zinc-400 mb-1">Closing Time</label>
//                   <input
//                     type="time"
//                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-lime-400"
//                     value={formData.closing_time}
//                     onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
//                   />
//                 </div>
//               </div>

//               <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
//                 <button
//                   type="button"
//                   onClick={() => setShowModal(false)}
//                   className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-semibold hover:bg-zinc-800"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={submitting}
//                   className="px-5 py-2.5 bg-lime-400 text-zinc-950 font-bold text-xs rounded-xl hover:bg-lime-300 disabled:opacity-50"
//                 >
//                   {submitting ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { useBranch } from '../context/BranchContext';

const fontMono = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };

export default function BranchesPage() {
  const { activeBranch, switchBranch, refreshBranches } = useBranch();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const initialForm = {
    name: '',
    code: '',
    phone: '',
    email: '',
    address_line1: '',
    city: '',
    state: '',
    pincode: '',
    opening_time: '06:00',
    closing_time: '22:00'
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchBranchesList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/v1/branches');
      if (res?.success) {
        setBranches(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranchesList();
  }, [fetchBranchesList]);

  const handleOpenCreateModal = () => {
    setEditingBranch(null);
    setFormData(initialForm);
    setErrorMsg('');
    setSuccessInfo(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name || '',
      code: branch.code || '',
      phone: branch.phone || '',
      email: branch.email || '',
      address_line1: branch.address_line1 || '',
      city: branch.city || '',
      state: branch.state || '',
      pincode: branch.pincode || '',
      opening_time: branch.opening_time || '06:00',
      closing_time: branch.closing_time || '22:00'
    });
    setErrorMsg('');
    setSuccessInfo(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name?.trim() || !formData.code?.trim()) {
      setErrorMsg('Branch Name and Unique Identifier Code are required.');
      return;
    }

    setSubmitting(true);
    try {
      let res;
      const isEdit = Boolean(editingBranch);
      if (isEdit) {
        res = await apiPut(`/api/v1/branches/${editingBranch.id}`, formData);
      } else {
        res = await apiPost('/api/v1/branches', formData);
      }

      if (res?.success) {
        setSuccessInfo({
          type: isEdit ? 'updated' : 'created',
          name: formData.name,
          code: formData.code
        });

        fetchBranchesList();
        refreshBranches();

        setTimeout(() => {
          setShowModal(false);
          setSuccessInfo(null);
          setFormData(initialForm);
        }, 1800);
      } else {
        setErrorMsg(res?.message || 'Unable to process branch update. Please verify input data.');
      }
    } catch (err) {
      setErrorMsg('Network connectivity error. Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (branch) => {
    if (!window.confirm(`Are you sure you want to permanently remove branch '${branch.name}'?`)) return;

    const res = await apiDelete(`/api/v1/branches/${branch.id}`);
    if (res?.success) {
      fetchBranchesList();
      refreshBranches();
    } else {
      alert(res?.message || 'Failed to remove branch location.');
    }
  };

  return (
    <div className="space-y-6 font-sans antialiased text-zinc-100">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-6 rounded-2xl shadow-sm"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold tracking-widest text-lime-400 uppercase">
              Location Infrastructure
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
            Multi-Branch Network
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
            Consolidated franchise outlets, door access telemetry, and live member allocations.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 bg-lime-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-lime-300 transition shadow-lg shadow-lime-400/20 whitespace-nowrap"
        >
          + Add New Branch
        </motion.button>
      </motion.div>

      {/* Branch Cards Grid */}
      {loading ? (
        <div className="text-center py-24 text-zinc-500 font-mono text-xs tracking-wider uppercase">
          <span className="inline-block w-2 h-2 rounded-full bg-lime-400 animate-ping mr-2" />
          Synchronizing Branch Ledgers...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b, idx) => {
            const isCurrentlyActive = activeBranch?.id === b.id;

            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.04 }}
                whileHover={{ y: -3 }}
                className={`bg-zinc-900/70 border rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 ${
                  isCurrentlyActive
                    ? 'border-lime-400/60 ring-1 ring-lime-400/30 shadow-lg shadow-lime-400/10'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight leading-snug">{b.name}</h3>
                      <span
                        style={fontMono}
                        className="text-[10px] font-semibold text-zinc-400 bg-zinc-950/80 border border-zinc-800 px-2 py-0.5 rounded mt-1.5 inline-block uppercase tracking-wider"
                      >
                        LOC: {b.code}
                      </span>
                    </div>

                    {isCurrentlyActive ? (
                      <span
                        style={fontMono}
                        className="text-[10px] bg-lime-400/10 text-lime-400 border border-lime-400/30 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                        Current Active
                      </span>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => switchBranch(b.id)}
                        className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded-full font-semibold transition"
                      >
                        Switch To ↗
                      </motion.button>
                    )}
                  </div>

                  <div className="space-y-2 text-xs text-zinc-400 mt-4 leading-relaxed">
                    <p className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0">📍</span>
                      <span className="line-clamp-2 text-zinc-300">
                        {b.address_line1 ? `${b.address_line1}, ${b.city || ''}` : 'Location details not registered'}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-zinc-500 shrink-0">📞</span>
                      <span style={fontMono} className="text-zinc-300">{b.phone || 'Phone unassigned'}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-zinc-500 shrink-0">⏰</span>
                      <span style={fontMono} className="text-zinc-300">
                        {b.opening_time || '06:00'} — {b.closing_time || '22:00'}
                      </span>
                    </p>

                    <div className="mt-4 p-3 rounded-xl bg-black/60 border border-zinc-800/80 flex items-center justify-between">
                      <span className="text-zinc-400 font-medium text-[11px] uppercase tracking-wider">
                        Active Members
                      </span>
                      <span style={fontMono} className="text-lime-400 font-black text-sm tabular-nums">
                        {Number(b.active_members_count || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/80 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleOpenEditModal(b)}
                      className="text-zinc-400 hover:text-white font-semibold transition text-xs"
                    >
                      Edit
                    </button>
                    <span className="text-zinc-700">|</span>
                    <button
                      onClick={() => handleDelete(b)}
                      className="text-red-400 hover:text-red-300 font-semibold transition text-xs"
                    >
                      Delete
                    </button>
                  </div>
                  <span
                    style={fontMono}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      b.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {b.is_active ? 'OPERATIONAL' : 'OFFLINE'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal with Professional Typography & Animation */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto shadow-2xl relative"
            >
              <AnimatePresence mode="wait">
                {successInfo ? (
                  /* ================= SUCCESS STATE ================= */
                  <motion.div
                    key="success-box"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="py-12 flex flex-col items-center justify-center text-center space-y-4"
                  >
                    <div className="relative flex items-center justify-center">
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute w-20 h-20 rounded-full bg-lime-400/20"
                      />
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                        className="w-16 h-16 rounded-full bg-lime-400 text-black flex items-center justify-center text-3xl font-black shadow-lg shadow-lime-400/35 relative z-10"
                      >
                        ✓
                      </motion.div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <h3 className="text-xl font-black text-white tracking-tight">
                        {successInfo.type === 'created' ? 'Branch Created Successfully' : 'Branch Updated Successfully'}
                      </h3>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                        Location <span className="text-lime-400 font-bold">{successInfo.name}</span>{' '}
                        <span style={fontMono} className="text-zinc-300">({successInfo.code})</span> is now synced to the live network ledger.
                      </p>
                    </div>

                    <div style={fontMono} className="pt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
                      Syncing database & auto-closing...
                    </div>
                  </motion.div>
                ) : (
                  /* ================= FORM STATE ================= */
                  <motion.div
                    key="form-box"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-800">
                      <div>
                        <span className="text-[10px] font-mono font-bold tracking-widest text-lime-400 uppercase">
                          Configuration
                        </span>
                        <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                          {editingBranch ? 'Edit Branch Location' : 'Register New Branch'}
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowModal(false)}
                        className="text-zinc-500 hover:text-white text-lg p-1 transition"
                      >
                        ✕
                      </button>
                    </div>

                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2"
                      >
                        <span>⚠️</span>
                        <span>{errorMsg}</span>
                      </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Branch Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. IronCore Hub"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Unique Branch Code *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. IC-02"
                            style={fontMono}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white uppercase outline-none focus:border-lime-400 transition"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Primary Contact Phone</label>
                          <input
                            type="tel"
                            placeholder="9876543210"
                            style={fontMono}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Official Email Address</label>
                          <input
                            type="email"
                            placeholder="hub@ironcore.com"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Address Line</label>
                        <input
                          type="text"
                          placeholder="Premises, Street or Landmark"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                          value={formData.address_line1}
                          onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">City</label>
                          <input
                            type="text"
                            placeholder="Jaipur"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">State</label>
                          <input
                            type="text"
                            placeholder="Rajasthan"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Pincode</label>
                          <input
                            type="text"
                            placeholder="302017"
                            style={fontMono}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.pincode}
                            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Opening Hours</label>
                          <input
                            type="time"
                            style={fontMono}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.opening_time}
                            onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Closing Hours</label>
                          <input
                            type="time"
                            style={fontMono}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-lime-400 transition"
                            value={formData.closing_time}
                            onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setShowModal(false)}
                          className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-semibold hover:bg-zinc-800 transition"
                        >
                          Cancel
                        </button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={submitting}
                          className="px-6 py-2.5 bg-lime-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-lime-300 disabled:opacity-50 transition shadow-lg shadow-lime-400/20"
                        >
                          {submitting ? 'Processing...' : editingBranch ? 'Update Location' : 'Register Location'}
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}