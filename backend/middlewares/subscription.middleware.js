const db = require('../config/db');

// Helper: Tenant ka active subscription details aur plan specs resolve karein
async function resolveTenantSubscription(orgId) {
  const query = `
    SELECT 
      s.id AS subscription_id,
      s.status AS subscription_status,
      s.trial_end_date,
      s.end_date,
      p.id AS plan_id,
      p.hash_id AS plan_hash_id,
      p.name AS plan_name,
      p.max_branches,
      p.max_members,
      p.max_users,
      p.features
    FROM saas_subscriptions s
    JOIN saas_plans p ON p.id = s.plan_id
    WHERE s.organization_id = $1 AND s.status IN ('trial', 'active')
    ORDER BY s.id DESC
    LIMIT 1;
  `;
  const { rows } = await db.query(query, [orgId]);
  return rows[0] || null;
}

// ================================================================
// 1. RESOURCE QUOTA GUARD: BRANCH LIMIT
// ================================================================
exports.checkBranchLimit = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.user?.orgId;
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);

    if (isSuperAdmin) return next();

    const sub = await resolveTenantSubscription(orgId);

    // Agar plan me limit NULL hai to unlimited allowed hai
    if (sub && sub.max_branches === null) {
      return next();
    }

    const maxAllowed = sub ? sub.max_branches : 1;

    const countRes = await db.query(
      `SELECT COUNT(id) FROM branches WHERE organization_id = $1 AND deleted_at IS NULL`,
      [orgId]
    );
    const currentBranchCount = parseInt(countRes.rows[0].count, 10);

    if (currentBranchCount >= maxAllowed) {
      return res.status(403).json({
        success: false,
        upgrade_required: true,
        code: 'BRANCH_LIMIT_EXCEEDED',
        current_count: currentBranchCount,
        max_allowed: maxAllowed,
        message: `Plan Quota Exceeded: Aapke current plan ('${sub?.plan_name || 'Starter'}') me maximum ${maxAllowed} branch(es) allowed hain. Agli location open karne ke liye plan upgrade karein.`
      });
    }

    next();
  } catch (error) {
    console.error('Branch limit verification error:', error);
    return res.status(500).json({ success: false, message: 'Branch quota check failed.', error: error.message });
  }
};

// ================================================================
// 2. RESOURCE QUOTA GUARD: ACTIVE MEMBERS LIMIT
// ================================================================
exports.checkMemberLimit = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.user?.orgId;
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);

    if (isSuperAdmin) return next();

    const sub = await resolveTenantSubscription(orgId);

    if (sub && sub.max_members === null) {
      return next();
    }

    const maxAllowed = sub ? sub.max_members : 250;

    const countRes = await db.query(
      `SELECT COUNT(id) FROM members WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [orgId]
    );
    const activeMembersCount = parseInt(countRes.rows[0].count, 10);

    if (activeMembersCount >= maxAllowed) {
      return res.status(403).json({
        success: false,
        upgrade_required: true,
        code: 'MEMBER_LIMIT_EXCEEDED',
        current_count: activeMembersCount,
        max_allowed: maxAllowed,
        message: `Member Capacity Reached: Aapke plan me maximum ${maxAllowed} active members allowed hain. Naye members register karne ke liye plan upgrade karein.`
      });
    }

    next();
  } catch (error) {
    console.error('Member quota verification error:', error);
    return res.status(500).json({ success: false, message: 'Member quota check failed.', error: error.message });
  }
};

// ================================================================
// 3. RESOURCE QUOTA GUARD: STAFF / USER SEATS
// ================================================================
exports.checkUserLimit = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.user?.orgId;
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);

    if (isSuperAdmin) return next();

    const sub = await resolveTenantSubscription(orgId);

    if (sub && sub.max_users === null) {
      return next();
    }

    const maxAllowed = sub ? sub.max_users : 3;

    const countRes = await db.query(
      `SELECT COUNT(id) FROM users WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [orgId]
    );
    const activeStaffCount = parseInt(countRes.rows[0].count, 10);

    if (activeStaffCount >= maxAllowed) {
      return res.status(403).json({
        success: false,
        upgrade_required: true,
        code: 'STAFF_SEATS_EXCEEDED',
        current_count: activeStaffCount,
        max_allowed: maxAllowed,
        message: `Staff seat limit reached: Current tier allows up to ${maxAllowed} staff accounts.`
      });
    }

    next();
  } catch (error) {
    console.error('Staff seat verification error:', error);
    return res.status(500).json({ success: false, message: 'User seat check failed.' });
  }
};

// ================================================================
// 4. FEATURE ENTITLEMENT GUARD (Selective Feature Lock)
// ================================================================
exports.requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const orgId = req.orgId || req.user?.orgId;
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);

      if (isSuperAdmin) return next();

      const sub = await resolveTenantSubscription(orgId);

      // Agar plan me ye feature enabled nahi hai ya false hai
      const isFeatureUnlocked = sub?.features?.[featureKey] === true;

      if (!isFeatureUnlocked) {
        return res.status(403).json({
          success: false,
          upgrade_required: true,
          code: 'FEATURE_NOT_PERMITTED',
          feature: featureKey,
          current_plan: sub?.plan_name || 'Starter Solo',
          message: `Action Blocked: Ye feature ('${featureKey}') aapke current plan me shamil nahi hai. Upgrade your subscription to unlock this feature.`
        });
      }

      req.tenantFeatures = sub?.features;
      next();
    } catch (error) {
      console.error(`Feature permission error for [${featureKey}]:`, error);
      return res.status(500).json({ success: false, message: 'Feature authorization check failed.' });
    }
  };
};

// ================================================================
// 5. ATTACH PLAN SNAPSHOT TO CONTEXT (For Fast Reads / Frontend)
// ================================================================
exports.attachPlanContext = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.user?.orgId;
    if (orgId) {
      const sub = await resolveTenantSubscription(orgId);
      req.subscription = sub;
    }
    next();
  } catch (e) {
    next();
  }
};