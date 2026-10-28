import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet } from '../api';
import { useBranch } from '../context/BranchContext';

export default function Dashboard() {
  const { activeBranch } = useBranch();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchedBranchRef = useRef(null);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use activeBranch directly from central context
      const queryParam = activeBranch?.id ? `?branch_id=${activeBranch.id}` : '';
      const response = await apiGet(`/api/v1/dashboard/stats${queryParam}`);

      if (response?.success) {
        setData(response.data);
      } else {
        setError(response?.message || 'Dashboard data load nahi ho paya.');
      }
    } catch (err) {
      setError(err.message || 'Server connection error');
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    // Only re-fetch if branch actually changes or initial mount
    if (lastFetchedBranchRef.current !== activeBranch?.id) {
      lastFetchedBranchRef.current = activeBranch?.id;
      fetchDashboardStats();
    }
  }, [activeBranch?.id, fetchDashboardStats]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-400"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center text-red-400">
        <p className="font-semibold">Error: {error}</p>
        <button 
          onClick={fetchDashboardStats} 
          className="mt-3 px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const members = data?.members || {};
  const revenue = data?.revenue || {};
  const attendance = data?.attendance_today || {};
  const leads = data?.leads || {};
  const expiringSoon = data?.expiring_soon || [];

  const stats = [
    {
      label: 'Active Members',
      value: members.active_members || 0,
      subText: `Total: ${members.total_members || 0} | Expired: ${members.expired_members || 0}`,
      icon: '👥',
      badge: 'Active',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    {
      label: 'Today Check-ins',
      value: attendance.today_checkins || 0,
      subText: `Passed: ${attendance.successful_entries || 0} | Denied: ${attendance.denied_entries || 0}`,
      icon: '🗓️',
      badge: 'Live',
      badgeColor: 'bg-lime-400/10 text-lime-400 border-lime-400/20'
    },
    {
      label: 'Monthly Revenue',
      value: `₹${(revenue.this_month || 0).toLocaleString('en-IN')}`,
      subText: `Today: ₹${(revenue.today || 0).toLocaleString('en-IN')}`,
      icon: '💳',
      badge: `Due: ₹${(revenue.pending_due || 0).toLocaleString('en-IN')}`,
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    },
    {
      label: 'Active Leads',
      value: leads.total_leads || 0,
      subText: `New: ${leads.new_leads || 0} | Trial: ${leads.trial_leads || 0}`,
      icon: '🎯',
      badge: 'Pipeline',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Dynamic Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${stat.badgeColor}`}>
                {stat.badge}
              </span>
            </div>
            <p className="text-zinc-400 text-xs font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold mt-1 text-white">{stat.value}</h3>
            <p className="text-[11px] text-zinc-500 mt-2 font-medium">{stat.subText}</p>
          </div>
        ))}
      </div>

      {/* Memberships Expiring Soon Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-white">Expiring Soon (Next 7 Days)</h3>
            <p className="text-xs text-zinc-500">Un members ki list jinhe renewal message bhejna hai</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
            {expiringSoon.length} Action Needed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/50 text-xs text-zinc-500 uppercase border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {expiringSoon.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-zinc-500 text-xs">
                    Agle 7 dino me kisi member ki membership expire nahi ho rahi hai.
                  </td>
                </tr>
              ) : (
                expiringSoon.map((m, idx) => (
                  <tr key={m.member_hash_id || idx} className="hover:bg-zinc-800/50 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {m.first_name} {m.last_name || ''}
                      <span className="block text-[11px] font-normal text-zinc-500">{m.member_code}</span>
                    </td>
                    <td className="py-3.5 px-4">{m.plan_name}</td>
                    <td className="py-3.5 px-4 text-amber-400 font-medium">
                      {m.end_date ? new Date(m.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">{m.phone || 'N/A'}</td>
                    <td className="py-3.5 px-4">
                      {m.phone && (
                        <a
                          href={`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(m.first_name)},%20your%20gym%20membership%20is%20expiring%20soon.`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-lime-400/10 text-lime-400 border border-lime-400/20 hover:bg-lime-400 hover:text-black transition"
                        >
                          WhatsApp Remind
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}