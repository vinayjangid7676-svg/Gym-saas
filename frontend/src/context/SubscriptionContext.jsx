import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api';

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/v1/saas/current');
      if (res?.success) {
        setSubscriptionData(res.data);
      }
    } catch (err) {
      console.error('Subscription context load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Helper function: Kisi bhi UI component me feature check karne ke liye
  const hasFeature = (featureKey) => {
    if (!subscriptionData?.plan?.features) return false;
    return subscriptionData.plan.features[featureKey] === true;
  };

  // Helper function: Quota full ho gaya ya nahi check karne ke liye
  const isBranchLimitReached = () => {
    const limits = subscriptionData?.plan?.limits;
    const usage = subscriptionData?.usage;
    if (!limits || limits.max_branches === null) return false; // Unlimited
    return (usage?.branches || 0) >= limits.max_branches;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription: subscriptionData?.subscription,
        plan: subscriptionData?.plan,
        usage: subscriptionData?.usage,
        hasFeature,
        isBranchLimitReached,
        refreshSubscription: fetchSubscription,
        loading
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be wrapped inside <SubscriptionProvider>');
  }
  return ctx;
};