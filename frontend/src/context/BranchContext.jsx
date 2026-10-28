import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../api';

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);

  const loadBranches = useCallback(async () => {
    // Prevent duplicate parallel execution across React StrictMode / mounts
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoading(true);
      const res = await apiGet('/api/v1/branches');

      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setBranches(res.data);

        const savedBranchId = localStorage.getItem('gym_active_branch_id');
        let selected = res.data.find(
          (b) => String(b.id) === String(savedBranchId) || String(b.hash_id) === String(savedBranchId)
        );

        // Fallback to active branch if saved is invalid
        if (!selected) {
          selected = res.data.find((b) => b.is_active) || res.data[0];
        }

        setActiveBranch(selected);
        localStorage.setItem('gym_active_branch_id', String(selected.id));
      } else {
        setBranches([]);
        setActiveBranch(null);
        localStorage.removeItem('gym_active_branch_id');
      }
    } catch (e) {
      console.error('Failed to load branch context:', e);
      setBranches([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const switchBranch = (branchIdentifier) => {
    const selected = branches.find(
      (b) => String(b.id) === String(branchIdentifier) || String(b.hash_id) === String(branchIdentifier)
    );

    if (selected) {
      setActiveBranch(selected);
      localStorage.setItem('gym_active_branch_id', String(selected.id));

      window.dispatchEvent(
        new CustomEvent('branchChanged', {
          detail: { branchId: selected.id, branchName: selected.name }
        })
      );
    }
  };

  return (
    <BranchContext.Provider
      value={{
        branches,
        activeBranch,
        switchBranch,
        loading,
        refreshBranches: loadBranches
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch hook must be used within a valid <BranchProvider>');
  }
  return context;
};