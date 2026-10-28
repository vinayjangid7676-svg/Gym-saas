import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiPut, saveSession } from '../api';
import PendingApprovalsTab from '../components/superadmin/PendingApprovalsTab';

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [settings, setSettings] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ title: '', message: '', banner_type: 'info' });
  const [pendingQueue, setPendingQueue] = useState([]);

  const loadPlatformData = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ FIX: pendingRes ko array destructuring me add kiya gaya hai
      const [dashRes, gymsRes, ancRes, setRes, pendingRes] = await Promise.all([
        apiGet('/api/v1/super-admin/dashboard'),
        apiGet('/api/v1/super-admin/gyms'),
        apiGet('/api/v1/super-admin/announcements'),
        apiGet('/api/v1/super-admin/settings'),
        apiGet('/api/v1/super-admin/pending-approvals')
      ]);

      if (dashRes?.success) setDashboardData(dashRes.data);
      if (gymsRes?.success) setGyms(gymsRes.gyms || []);
      if (ancRes?.success) setAnnouncements(ancRes.data || []);
      if (setRes?.success) setSettings(setRes.settings || {});
      if (pendingRes?.success) setPendingQueue(pendingRes.data || []);
    } catch (err) {
      console.error('Super Admin Data Load Failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatformData();
  }, [loadPlatformData]);

  const handleStatusToggle = async (orgId, targetStatus) => {
    if (!window.confirm(`Kya aap sure hain ki is gym ko "${targetStatus}" karna chahte hain?`)) return;
    setActionLoading(true);
    const res = await apiPatch('/api/v1/super-admin/gyms/status', {
      organization_id: orgId,
      status: targetStatus
    });
    setActionLoading(false);
    if (res?.success) {
      loadPlatformData();
    } else {
      alert(res?.message || 'Status update fail hua.');
    }
  };

  const handleExtendTrial = async (orgId) => {
    const days = prompt('Kitne din ka trial extend karna hai?', '7');
    if (!days || isNaN(days)) return;
    setActionLoading(true);
    const res = await apiPost('/api/v1/super-admin/gyms/extend-trial', {
      organization_id: orgId,
      extra_days: parseInt(days, 10)
    });
    setActionLoading(false);
    if (res?.success) {
      alert(res.message);
      loadPlatformData();
    } else {
      alert(res?.message || 'Trial extend fail hua.');
    }
  };

  const handleImpersonate = async (orgId, gymName) => {
    if (!window.confirm(`⚠️ GHOST LOGIN:\nAap "${gymName}" ke dashboard me enter kar rahe hain.`)) return;
    setActionLoading(true);
    const res = await apiPost('/api/v1/super-admin/impersonate', {
      organization_id: orgId,
      reason: 'Platform Admin audit'
    });
    setActionLoading(false);
    if (res?.success && res.token) {
      saveSession({ token: res.token, user: res.user });
      window.location.href = '/dashboard';
    } else {
      alert(res?.message || 'Impersonation failed.');
    }
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const res = await apiPost('/api/v1/super-admin/announcements', announceForm);
    setActionLoading(false);
    if (res?.success) {
      setShowAnnounceModal(false);
      setAnnounceForm({ title: '', message: '', banner_type: 'info' });
      loadPlatformData();
    } else {
      alert(res?.message || 'Broadcast create fail hua.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const res = await apiPut('/api/v1/super-admin/settings', settings);
    setActionLoading(false);
    if (res?.success) {
      alert('Platform Global Settings updated!');
      loadPlatformData();
    } else {
      alert(res?.message || 'Settings update fail hui.');
    }
  };

  const handleAdminLogout = () => {
    localStorage.clear();
    window.location.href = '/admin/login';
  };

  const filteredGyms = gyms.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.owner_name && g.owner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (g.owner_phone && g.owner_phone.includes(searchTerm));
    const matchesStatus = statusFilter === 'all' || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 text-sm font-medium">Connecting to Master Console...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Master Deck Top Navbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 p-6 rounded-3xl shadow-xl">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <h1 className="text-xl font-black text-white tracking-tight uppercase">Master Platform Console</h1>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Global Multi-Tenant Control · Live Metrics, Impersonation & Platform Configuration
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
              {[
                { id: 'overview', label: '📊 Metrics' },
                { id: 'approvals', label: `🔔 Approvals (${pendingQueue.length})` },
                { id: 'gyms', label: '🏢 Tenants' },
                { id: 'announcements', label: '📢 Broadcasts' },
                { id: 'settings', label: '⚙️️ Settings' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 font-bold rounded-lg transition ${
                    activeTab === tab.id ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleAdminLogout}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 text-xs font-bold border border-zinc-800 transition"
            >
              Exit Deck 🚪
            </button>
          </div>
        </div>

        {/* TAB 1: EXECUTIVE METRICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Platform Revenue</span>
                <p className="text-3xl font-black text-white mt-1">₹{dashboardData?.financials?.total_revenue?.toLocaleString('en-IN')}</p>
                <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">Current Month: ₹{dashboardData?.financials?.mrr?.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Active Gym Tenants</span>
                <p className="text-3xl font-black text-white mt-1">{dashboardData?.gyms?.total_gyms || 0}</p>
                <span className="text-[11px] text-zinc-400 font-medium mt-1 block">{dashboardData?.gyms?.active_gyms} Active · {dashboardData?.gyms?.trial_gyms} Free Trials</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Enrolled Members</span>
                <p className="text-3xl font-black text-white mt-1">{dashboardData?.total_active_members?.toLocaleString('en-IN') || 0}</p>
                <span className="text-[11px] text-zinc-500 font-medium mt-1 block">Active platform athletes</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Branch Network</span>
                <p className="text-3xl font-black text-white mt-1">{dashboardData?.total_branches || 0}</p>
                <span className="text-[11px] text-zinc-500 font-medium mt-1 block">Operating physical outlets</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-white mb-3">⚠️ Expiring In 7 Days</h3>
                {dashboardData?.expiring_soon?.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-8 text-center">No subscriptions requiring attention.</p>
                ) : (
                  <div className="divide-y divide-zinc-900">
                    {dashboardData?.expiring_soon?.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{item.gym_name}</p>
                          <span className="text-[11px] text-zinc-500">Tier: {item.plan_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-amber-400 font-mono text-[11px] block">{new Date(item.end_date || item.trial_end_date).toLocaleDateString()}</span>
                          <button onClick={() => handleExtendTrial(item.org_id)} className="text-[11px] text-red-400 font-bold hover:underline">
                            + Extend Days
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-white mb-3">Subscription Distribution</h3>
                <div className="space-y-3">
                  {dashboardData?.plan_distribution?.map((p) => (
                    <div key={p.plan_name} className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
                      <span className="text-xs font-semibold text-zinc-300">{p.plan_name}</span>
                      <span className="text-xs font-black text-white bg-zinc-800 px-2.5 py-1 rounded">
                        {p.subscriber_count} Gyms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: PENDING APPROVALS QUEUE */}
        {activeTab === 'approvals' && (
          <PendingApprovalsTab
            pendingList={pendingQueue}
            onRefresh={loadPlatformData}
            onGhostLogin={handleImpersonate}
          />
        )}

        {/* TAB 2: TENANTS & KILL-SWITCH */}
        {activeTab === 'gyms' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between bg-zinc-950 border border-zinc-900 p-4 rounded-2xl">
              <input
                type="text"
                placeholder="Search Gym Name, Owner, Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-red-500 sm:w-80"
              />
              <div className="flex gap-2">
                {['all', 'active', 'trial', 'suspended'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition ${
                      statusFilter === st ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-900/50 text-zinc-500 uppercase tracking-wider text-[11px]">
                    <th className="p-4">Gym Tenant</th>
                    <th className="p-4">Owner Profile</th>
                    <th className="p-4">Current Tier</th>
                    <th className="p-4">Resources</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Root Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredGyms.map((gym) => (
                    <tr key={gym.id} className="hover:bg-zinc-900/30 transition">
                      <td className="p-4">
                        <p className="font-bold text-white text-sm">{gym.name}</p>
                        <span className="text-[11px] text-zinc-500 font-mono">slug: {gym.slug}</span>
                      </td>
                      <td className="p-4">
                        <p className="text-zinc-200 font-semibold">{gym.owner_name || 'N/A'}</p>
                        <p className="text-[11px] text-zinc-500">{gym.owner_phone} · {gym.owner_email}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 font-mono text-[11px] border border-zinc-800">
                          {gym.current_plan || 'Starter'}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-300">
                        <p>📍 {gym.branch_count} Branches</p>
                        <p>👥 {gym.member_count} Members</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          gym.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          gym.status === 'trial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {gym.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleImpersonate(gym.id, gym.name)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-red-400 font-bold rounded-lg border border-zinc-800 text-[11px] transition"
                        >
                          👁️ Ghost Login
                        </button>
                        {gym.status === 'suspended' ? (
                          <button
                            onClick={() => handleStatusToggle(gym.id, 'active')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px]"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusToggle(gym.id, 'suspended')}
                            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold rounded-lg border border-red-600/30 text-[11px]"
                          >
                            Kill Switch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: BROADCASTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-zinc-950 border border-zinc-900 p-4 rounded-2xl">
              <p className="text-xs text-zinc-500">Broadcasts appear as dismissible top banners on all gym portals.</p>
              <button
                onClick={() => setShowAnnounceModal(true)}
                className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-500"
              >
                + Create Announcement
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((anc) => (
                <div key={anc.id} className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-white text-sm">{anc.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-zinc-900 text-zinc-300">
                      {anc.banner_type}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">{anc.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PLATFORM CONFIG */}
        {activeTab === 'settings' && (
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl max-w-2xl space-y-4">
            <h3 className="text-base font-bold text-white">System Global Settings</h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Platform Name</label>
                <input
                  type="text"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                  value={settings?.platform_name || ''}
                  onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Default Trial (Days)</label>
                  <input
                    type="number"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                    value={settings?.default_trial_days || 14}
                    onChange={(e) => setSettings({ ...settings, default_trial_days: parseInt(e.target.value, 10) })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Support Official Phone</label>
                  <input
                    type="text"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                    value={settings?.support_phone || ''}
                    onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Emergency Maintenance Mode</label>
                <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Lock all tenant portals for scheduled downtime</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings?.maintenance_mode)}
                    onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                    className="w-5 h-5 accent-red-600 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-500"
              >
                {actionLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ANNOUNCEMENT MODAL */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4">New Global Announcement</h3>
            <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                  value={announceForm.title}
                  onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Message</label>
                <textarea
                  required
                  rows="3"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                  value={announceForm.message}
                  onChange={(e) => setAnnounceForm({ ...announceForm, message: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAnnounceModal(false)} className="px-4 py-2 rounded-xl text-zinc-500 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-500">
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}