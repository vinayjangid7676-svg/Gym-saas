import React, { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../api';

export default function MembershipLifecycleModal({ isOpen, onClose, membership, onSuccess }) {
  const [activeTab, setActiveTab] = useState('freeze'); // 'freeze' | 'extend' | 'transfer' | 'addon'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form States
  const [freezeData, setFreezeData] = useState({ start_date: '', end_date: '', reason: '' });
  const [extendData, setExtendData] = useState({ days_added: '', reason: '' });
  const [transferData, setTransferData] = useState({ to_member_id: '', transfer_fee: '0', reason: '' });
  const [addonData, setAddonData] = useState({ addon_id: '', quantity: 1, price: '' });

  // Data Lists
  const [allMembers, setAllMembers] = useState([]);
  const [availableAddons, setAvailableAddons] = useState([]);

  useEffect(() => {
    if (isOpen && membership) {
      if (activeTab === 'transfer') fetchMembersList();
      if (activeTab === 'addon') fetchAddonsList();
    }
  }, [isOpen, activeTab, membership]);

  // Guard Clause: Agar Modal open nahi hai ya membership empty/null hai toh render mat karo
  if (!isOpen || !membership) return null;

  const fetchMembersList = async () => {
    try {
      const res = await apiGet('/api/v1/members');
      if (res?.success) {
        setAllMembers((res.data || []).filter(m => m.id !== membership?.member_id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAddonsList = async () => {
    try {
      const res = await apiGet('/api/v1/memberships/lifecycle/addons');
      if (res?.success) {
        setAvailableAddons(res.addons || res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFreeze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost('/api/v1/memberships/lifecycle/freeze', {
        membership_id: membership.id,
        ...freezeData
      });
      if (res?.success) {
        onSuccess && onSuccess('Membership freeze ho gayi hai.');
        onClose();
      } else {
        setError(res?.message || 'Freeze karne me error aaya.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost('/api/v1/memberships/lifecycle/extend', {
        membership_id: membership.id,
        days_added: parseInt(extendData.days_added, 10),
        reason: extendData.reason
      });
      if (res?.success) {
        onSuccess && onSuccess('Membership extend ho gayi.');
        onClose();
      } else {
        setError(res?.message || 'Extend karne me error aaya.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost('/api/v1/memberships/lifecycle/transfer', {
        membership_id: membership.id,
        from_member_id: membership.member_id,
        to_member_id: parseInt(transferData.to_member_id, 10),
        transfer_fee: parseFloat(transferData.transfer_fee || 0),
        reason: transferData.reason
      });
      if (res?.success) {
        onSuccess && onSuccess('Membership successfully transfer ho gayi.');
        onClose();
      } else {
        setError(res?.message || 'Transfer karne me error aaya.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAttachAddon = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost('/api/v1/memberships/lifecycle/addons/attach', {
        membership_id: membership.id,
        addon_id: parseInt(addonData.addon_id, 10),
        quantity: parseInt(addonData.quantity, 10),
        price: parseFloat(addonData.price)
      });
      if (res?.success) {
        onSuccess && onSuccess('Add-on membership par assign ho gaya.');
        onClose();
      } else {
        setError(res?.message || 'Add-on attach karne me error aaya.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/50">
          <div>
            <h3 className="text-base font-bold text-white">Manage Membership</h3>
            <p className="text-xs text-zinc-400">
              Member: <span className="text-lime-400 font-semibold">{membership?.member_name || `Member #${membership?.member_id}`}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg">✕</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/30">
          {[
            { id: 'freeze', label: 'Freeze (Pause)' },
            { id: 'extend', label: 'Extend Days' },
            { id: 'transfer', label: 'Transfer' },
            { id: 'addon', label: 'Attach Add-on' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(null); }}
              className={`flex-1 py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-lime-400 text-lime-400 bg-lime-400/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Tab Content Body */}
        <div className="p-6">
          {/* 1. FREEZE FORM */}
          {activeTab === 'freeze' && (
            <form onSubmit={handleFreeze} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={freezeData.start_date}
                    onChange={(e) => setFreezeData({ ...freezeData, start_date: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={freezeData.end_date}
                    onChange={(e) => setFreezeData({ ...freezeData, end_date: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Reason (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="e.g., Medical leave, Traveling"
                  value={freezeData.reason}
                  onChange={(e) => setFreezeData({ ...freezeData, reason: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-lime-400 outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-lime-400 text-black font-bold text-xs rounded-xl hover:bg-lime-300 transition disabled:opacity-50"
              >
                {loading ? 'Freezing...' : 'Confirm Freeze'}
              </button>
            </form>
          )}

          {/* 2. EXTEND FORM */}
          {activeTab === 'extend' && (
            <form onSubmit={handleExtend} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Days to Add</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g., 7, 15, 30"
                  value={extendData.days_added}
                  onChange={(e) => setExtendData({ ...extendData, days_added: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Reason (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="e.g., Special promo bonus, Maintenance compensation"
                  value={extendData.reason}
                  onChange={(e) => setExtendData({ ...extendData, reason: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-lime-400 outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-lime-400 text-black font-bold text-xs rounded-xl hover:bg-lime-300 transition disabled:opacity-50"
              >
                {loading ? 'Extending...' : 'Add Bonus Days'}
              </button>
            </form>
          )}

          {/* 3. TRANSFER FORM */}
          {activeTab === 'transfer' && (
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Transfer To Member</label>
                <select
                  required
                  value={transferData.to_member_id}
                  onChange={(e) => setTransferData({ ...transferData, to_member_id: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                >
                  <option value="">Select Target Member</option>
                  {allMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name || ''} ({m.member_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Transfer Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={transferData.transfer_fee}
                  onChange={(e) => setTransferData({ ...transferData, transfer_fee: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Reason (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="e.g., Member relocated"
                  value={transferData.reason}
                  onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-lime-400 outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-lime-400 text-black font-bold text-xs rounded-xl hover:bg-lime-300 transition disabled:opacity-50"
              >
                {loading ? 'Transferring...' : 'Complete Transfer'}
              </button>
            </form>
          )}

          {/* 4. ATTACH ADD-ON FORM */}
          {activeTab === 'addon' && (
            <form onSubmit={handleAttachAddon} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Select Add-on</label>
                <select
                  required
                  value={addonData.addon_id}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const selected = availableAddons.find(a => a.id === parseInt(selId, 10));
                    setAddonData({
                      ...addonData,
                      addon_id: selId,
                      price: selected ? selected.price : ''
                    });
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                >
                  <option value="">Choose Add-on (Steam, Sauna, Locker...)</option>
                  {availableAddons.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — ₹{a.price} ({a.duration_days ? `${a.duration_days} days` : 'One-time'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={addonData.quantity}
                    onChange={(e) => setAddonData({ ...addonData, quantity: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Price Charged (₹)</label>
                  <input
                    type="number"
                    required
                    value={addonData.price}
                    onChange={(e) => setAddonData({ ...addonData, price: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-lime-400 text-black font-bold text-xs rounded-xl hover:bg-lime-300 transition disabled:opacity-50"
              >
                {loading ? 'Attaching...' : 'Attach Add-on'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}