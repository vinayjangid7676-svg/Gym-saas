import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api';
import { useBranch } from '../context/BranchContext';
import MembershipLifecycleModal from './MembershipLifecycleModal';

export default function Members() {
  const navigate = useNavigate();
  const { branches, activeBranch } = useBranch();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  
  // Selected Branch ID strictly synced with Context
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranch?.id || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [count, setCount] = useState(0);

  // Modal State Variables
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Jab top header/context se active branch change ho, filter auto-sync ho
  useEffect(() => {
    if (activeBranch?.id) {
      setSelectedBranchId(activeBranch.id);
      setPage(1);
    }
  }, [activeBranch]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    
    // Explicitly pass resolved branch id
    const targetBranch = selectedBranchId || activeBranch?.id;
    if (targetBranch) {
      params.append('branch_id', targetBranch);
    }

    const res = await apiGet(`/api/v1/members?${params.toString()}`);
    if (res?.success) {
      setMembers(res.data || []);
      setCount(res.count || 0);
    }
    setLoading(false);
  }, [page, limit, search, status, selectedBranchId, activeBranch]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const totalPages = Math.max(1, Math.ceil(count / limit));

  const handleOpenLifecycle = (e, mbr) => {
    e.stopPropagation();
    setSelectedMembership({
      id: mbr.active_membership_id || mbr.membership_id || mbr.id,
      member_id: mbr.id || mbr.hash_id,
      member_name: `${mbr.first_name} ${mbr.middle_name || ''} ${mbr.last_name || ''}`.trim(),
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 p-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Members Directory</h1>
            {activeBranch?.name && (
              <span className="text-xs bg-lime-400/10 text-lime-400 border border-lime-400/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                📍 {activeBranch.name}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">
            Viewing active athletes enrolled in <strong className="text-zinc-200">{activeBranch?.name || 'current facility'}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <button
            onClick={() => navigate('/members/add')}
            className="bg-lime-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold hover:bg-lime-300 transition text-sm flex items-center gap-2 shadow-lg shadow-lime-400/10"
          >
            <span>+</span> Add New Member
          </button>
          <button
            onClick={() => navigate('/billing/create-invoice')}
            className="bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-xl font-bold hover:bg-zinc-700 transition text-sm flex items-center gap-2 border border-zinc-700"
          >
            🎫 New Sale / POS
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name, phone ya code..."
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 w-full focus:outline-none focus:border-lime-400 text-sm"
        />

        {/* Branch Filter Dropdown (Multiple branches hone par) */}
        {branches.length > 1 && (
          <select
            value={selectedBranchId}
            onChange={(e) => { setPage(1); setSelectedBranchId(e.target.value); }}
            className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm focus:border-lime-400 focus:outline-none md:w-56 font-bold"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                📍 {b.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm focus:border-lime-400 focus:outline-none md:w-44"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="frozen">Frozen</option>
        </select>

        <select
          value={limit}
          onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
          className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm focus:border-lime-400 focus:outline-none md:w-32"
        >
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>

      {/* Members Table */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Code</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Facility Branch</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Join Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan="7" className="text-center py-10 text-zinc-500 font-medium">Loading members for this branch...</td></tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-12 text-zinc-500">
                  <div className="text-center space-y-2">
                    <p className="text-base text-zinc-400 font-bold">Is branch me abhi koi member enrolled nahi hai.</p>
                    <p className="text-xs text-zinc-600">Top right "+ Add New Member" button se is branch me naya athlete add karein.</p>
                  </div>
                </td>
              </tr>
            ) : (
              members.map((mbr) => (
                <tr
                  key={mbr.hash_id}
                  onClick={() => navigate(`/members/${mbr.hash_id}`)}
                  className="hover:bg-zinc-800/40 transition cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono font-semibold text-lime-400">{mbr.member_code}</td>
                  <td className="px-6 py-4 font-medium text-white">{mbr.first_name} {mbr.middle_name || ''} {mbr.last_name || ''}</td>
                  <td className="px-6 py-4 font-mono text-zinc-300">{mbr.phone}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-zinc-400 font-medium bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                      {mbr.branch_name || 'Main Facility'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      mbr.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      mbr.status === 'frozen' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {mbr.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-400 font-mono text-xs">{new Date(mbr.join_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => handleOpenLifecycle(e, mbr)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-lime-400 hover:text-zinc-950 text-xs font-bold rounded-xl text-zinc-200 transition border border-zinc-700/50"
                    >
                      ⚙️ Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>Page {page} of {totalPages} • {count} members</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition">
            ← Prev
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition">
            Next →
          </button>
        </div>
      </div>

      {/* Lifecycle Modal Component */}
      <MembershipLifecycleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        membership={selectedMembership}
        onSuccess={() => {
          fetchMembers();
        }}
      />
    </div>
  );
}