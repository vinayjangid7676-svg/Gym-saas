import React, { useState, useCallback, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { apiGet } from '../../api';
import { useBranch } from '../../context/BranchContext';

export const inputCls =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-lime-400 focus:outline-none transition';
export const labelCls = 'text-xs text-zinc-400 block mb-1 font-medium';

export const PAYMENT_METHODS = ['bank_transfer', 'upi_qr', 'cash', 'cheque', 'pos_machine', 'razorpay', 'other'];

// ─── Sub Navigation (Added Dedicated Purchase Ledger Tab) ───
const NAV_ITEMS = [
  { to: '/inventory/stock', label: '📦 Stock Monitor' },
  { to: '/inventory/products', label: '🏷️ Products' },
  { to: '/inventory/vendors', label: '🚚 Vendors' },
  { to: '/inventory/purchases', label: '📥 New Purchase', end: true },
  { to: '/inventory/purchase-history', label: '📜 Purchase Ledger' },
  { to: '/inventory/returns', label: '↩ Purchase Returns' },
  // { to: '/inventory/pos', label: '⚡ POS Terminal' },
];

export function InvNav() {
  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
      {NAV_ITEMS.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `px-4 py-2 text-xs font-bold rounded-xl transition ${
              isActive ? 'bg-lime-400 text-zinc-950 shadow-sm' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`
          }
        >
          {n.label}
        </NavLink>
      ))}
    </div>
  );
}

// ─── Dynamic Branch ID Resolver ───
export function useBranchId() {
  const { activeBranch } = useBranch();

  return useCallback(() => {
    if (activeBranch?.id) return parseInt(activeBranch.id, 10);

    const savedId = localStorage.getItem('gym_active_branch_id');
    if (savedId && !isNaN(parseInt(savedId, 10))) {
      return parseInt(savedId, 10);
    }

    try {
      const u = JSON.parse(localStorage.getItem('gym_user'));
      return u?.branch_id || u?.branchId || u?.active_branch?.id || null;
    } catch {
      return null;
    }
  }, [activeBranch]);
}

// ─── Shared data hook: Live Reactive Stock + Vendors + Members ───
export function useInventoryData() {
  const { activeBranch } = useBranch();
  const getBranchId = useBranchId();

  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const branchId = getBranchId();
    const bQuery = branchId ? `?branch_id=${branchId}` : '';

    try {
      const [pRes, vRes, mRes] = await Promise.all([
        apiGet(`/api/v1/inventory/stock${bQuery}`).catch(() => ({ success: false, stock: [] })),
        apiGet('/api/v1/expenses/vendors').catch(() => ({ success: false, data: [] })),
        apiGet(`/api/v1/members${bQuery ? `${bQuery}&limit=100` : '?limit=100'}`).catch(() => ({ success: false, data: [] })),
      ]);

      if (pRes?.success) setProducts(pRes.stock || []);
      
      if (vRes?.success) {
        setVendors(vRes.data || vRes.vendors || []);
      } else {
        const altVRes = await apiGet('/api/v1/inventory/vendors').catch(() => ({ success: false }));
        if (altVRes?.success) setVendors(altVRes.data || altVRes.vendors || []);
      }

      if (mRes?.success) setMembers(mRes.data || []);
    } catch (err) {
      console.error('Inventory hook refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [getBranchId]);

  useEffect(() => {
    refresh();
  }, [activeBranch?.id, refresh]);

  useEffect(() => {
    const handleBranchSwitch = () => refresh();
    window.addEventListener('branchChanged', handleBranchSwitch);
    return () => window.removeEventListener('branchChanged', handleBranchSwitch);
  }, [refresh]);

  return { products, vendors, members, loading, refresh };
}

// ─── Modal Wrapper ───
export function ModalWrapper({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} p-5 space-y-4 my-8 shadow-2xl`}>
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Feedback Banner ───
export function Feedback({ success, error, onDismiss }) {
  if (!success && !error) return null;
  return (
    <div
      className={`flex justify-between items-center text-sm rounded-xl px-4 py-3 border ${
        success
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}
    >
      <span>{success || error}</span>
      <button onClick={onDismiss} className="ml-4 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}