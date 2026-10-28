import React, { useState } from 'react';
import { apiPost } from '../../api';

export default function PendingApprovalsTab({ pendingList, onRefresh, onGhostLogin }) {
  const [selectedReq, setSelectedReq] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async (item) => {
    if (!window.confirm(`Kya aap sach me Gym "${item.gym_name}" ka subscription approve karke live karna chahte hain?`)) return;

    setProcessing(true);
    try {
      const res = await apiPost('/api/v1/super-admin/process-approval', {
        subscription_id: item.subscription_id,
        organization_id: item.organization_id,
        action: 'approve'
      });

      if (res?.success) {
        alert(res.message);
        setSelectedReq(null);
        onRefresh();
      } else {
        alert(res?.message || 'Approval fail ho gaya.');
      }
    } catch (e) {
      alert('Network request fail ho gaya.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    setProcessing(true);
    try {
      const res = await apiPost('/api/v1/super-admin/process-approval', {
        subscription_id: selectedReq.subscription_id,
        organization_id: selectedReq.organization_id,
        action: 'reject',
        rejection_reason: rejectionReason
      });

      if (res?.success) {
        alert(res.message);
        setRejectModalOpen(false);
        setSelectedReq(null);
        setRejectionReason('');
        onRefresh();
      } else {
        alert(res?.message || 'Rejection fail ho gaya.');
      }
    } catch (e) {
      alert('Network request fail ho gaya.');
    } finally {
      setProcessing(false);
    }
  };

  if (!pendingList || pendingList.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-lime-400 border border-zinc-800 flex items-center justify-center text-xl mx-auto">
          ✓
        </div>
        <h3 className="text-base font-bold text-white">All Clear! No Pending Subscriptions</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Jab koi naya gym checkout karke subscription request submit karega, to wo yahan verification ke liye appear hogi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-zinc-950 border border-zinc-900 p-4 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            Pending Verification & Activation Queue ({pendingList.length})
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Gyms requiring manual/payment review before official activation.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl border border-zinc-800 transition"
        >
          🔄 Refresh Queue
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Requests List */}
        <div className="lg:col-span-7 space-y-3">
          {pendingList.map((item) => {
            const isSelected = selectedReq?.subscription_id === item.subscription_id;
            return (
              <div
                key={item.subscription_id}
                onClick={() => setSelectedReq(item)}
                className={`p-5 rounded-2xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900/90 border-lime-400/80 shadow-lg shadow-lime-400/5'
                    : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      {item.gym_name}
                      <span className="text-[10px] bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded font-mono uppercase font-bold">
                        Pending Review
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Owner: <span className="text-zinc-200 font-semibold">{item.owner_name}</span> · 📞 {item.owner_phone}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      📍 {item.branch_city || 'City N/A'}, {item.branch_state || 'State N/A'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-lime-400 block font-mono">
                      ₹{Number(item.total_amount || item.monthly_price).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase font-mono block mt-0.5">
                      {item.plan_name}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-900 flex justify-between items-center text-[11px] text-zinc-500">
                  <span>Req Date: {new Date(item.requested_at).toLocaleDateString()}</span>
                  <span className="text-lime-400 font-bold hover:underline">
                    View Details & Verify →
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Deep Review Panel */}
        <div className="lg:col-span-5 sticky top-28">
          {selectedReq ? (
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-6 shadow-2xl">
              <div className="border-b border-zinc-900 pb-4 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-lime-400 font-bold">Audit Inspection</span>
                  <h4 className="text-lg font-bold text-white">{selectedReq.gym_name}</h4>
                </div>
                <button
                  onClick={() => onGhostLogin(selectedReq.organization_id, selectedReq.gym_name)}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-[11px] font-bold"
                >
                  👁️ Audit Workspace
                </button>
              </div>

              {/* Gym Credentials */}
              <div className="space-y-2 text-xs">
                <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Organization & Legal Details</p>
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-900 space-y-1.5">
                  <p><span className="text-zinc-500">Slug:</span> <span className="font-mono text-zinc-300">{selectedReq.gym_slug}</span></p>
                  <p><span className="text-zinc-500">Legal Entity:</span> <span className="text-zinc-300 font-medium">{selectedReq.legal_name || 'Individual / Not set'}</span></p>
                  <p><span className="text-zinc-500">GSTIN:</span> <span className="font-mono text-zinc-300">{selectedReq.tax_id_gst || 'Unregistered'}</span></p>
                  <p><span className="text-zinc-500">Location:</span> <span className="text-zinc-300">{selectedReq.branch_city}, {selectedReq.branch_state}</span></p>
                </div>
              </div>

              {/* Owner Profile */}
              <div className="space-y-2 text-xs">
                <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Owner Information</p>
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-900 space-y-1.5">
                  <p><span className="text-zinc-500">Full Name:</span> <span className="text-white font-bold">{selectedReq.owner_name}</span></p>
                  <p><span className="text-zinc-500">Mobile (WhatsApp):</span> <span className="text-zinc-200 font-mono">{selectedReq.owner_phone}</span></p>
                  <p><span className="text-zinc-500">Email:</span> <span className="text-zinc-200">{selectedReq.owner_email || 'Not provided'}</span></p>
                </div>
              </div>

              {/* Subscription Breakdown */}
              <div className="space-y-2 text-xs">
                <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Subscription Order Specs</p>
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-900 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Plan Tier:</span>
                    <span className="font-bold text-white">{selectedReq.plan_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Branch Quota:</span>
                    <span className="text-zinc-300 font-medium">{selectedReq.max_branches ? `${selectedReq.max_branches} Branches` : 'Unlimited'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Athlete Capacity:</span>
                    <span className="text-zinc-300 font-medium">{selectedReq.max_members ? `${selectedReq.max_members} Members` : 'Unlimited'}</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-2 flex justify-between">
                    <span className="text-zinc-500">Total Invoice Amount:</span>
                    <span className="font-black text-lime-400 font-mono text-sm">
                      ₹{Number(selectedReq.total_amount || selectedReq.monthly_price).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => setRejectModalOpen(true)}
                  className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold text-xs transition disabled:opacity-50"
                >
                  ✕ Reject / Put on Hold
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleApprove(selectedReq)}
                  className="flex-1 py-3 bg-lime-400 hover:bg-lime-300 text-black rounded-xl font-black text-xs transition shadow-lg shadow-lime-400/20 disabled:opacity-50"
                >
                  {processing ? 'Activating...' : '✓ Approve & Activate'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center text-xs text-zinc-500">
              Left side se kisi bhi gym request ko select karke complete KYC aur payment inspect karein.
            </div>
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-900 w-full max-w-md rounded-3xl p-6 space-y-4">
            <h4 className="text-base font-bold text-white">Reject / Put Subscription on Hold</h4>
            <p className="text-xs text-zinc-400">
              Kripya reason dalein taaki gym owner ko clarify ho sake (e.g. UTR mismatch, fake KYC, verification failed).
            </p>
            <textarea
              rows="3"
              required
              placeholder="e.g. Payment screenshot / UTR number invalid hai..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-zinc-400 text-xs font-semibold hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-5 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-500"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}