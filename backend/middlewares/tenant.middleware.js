const db = require('../config/db');

module.exports = async function tenantGuard(req, res, next) {
  try {
    const userId = req.user?.userId || req.user?.id;
    const orgId = req.user?.orgId || req.user?.organization_id;
    const isSuperAdmin = Boolean(req.user?.isSuperAdmin || req.user?.is_super_admin);

    // ✅ FIX 1: Super Admin ko organization context ki zaroorat nahi hoti
    if (isSuperAdmin) {
      req.orgId = null;
      req.branchId = null;
      return next();
    }

    if (!userId || !orgId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Session context missing required tenant identifiers.'
      });
    }

    const parsedOrgId = parseInt(orgId, 10);
    req.orgId = parsedOrgId;

    // 1. Verify Organization Status
    const orgCheck = await db.query(
      `SELECT id, status FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [parsedOrgId]
    );

    if (orgCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization does not exist.' });
    }

    if (['suspended', 'cancelled'].includes(orgCheck.rows[0].status)) {
      return res.status(403).json({
        success: false,
        message: `Gym access suspended. Current status: ${orgCheck.rows[0].status}. Please contact billing support.`
      });
    }

    // 2. Resolve & Authorize Branch Access
    const rawBranchId = req.headers['x-branch-id'] || req.query.branch_id || req.body?.branch_id;
    let targetBranchId = rawBranchId ? parseInt(rawBranchId, 10) : null;

    // Role check for owner permission bypass
    const roleQuery = `
      SELECT r.slug 
      FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND (r.organization_id = $2 OR r.organization_id IS NULL)
    `;
    const roleRows = await db.query(roleQuery, [userId, parsedOrgId]);
    const roles = roleRows.rows.map((r) => r.slug.toLowerCase());
    const isOwner = roles.includes('owner');

    if (targetBranchId) {
      const branchRes = await db.query(
        `SELECT id, name, is_active FROM branches WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [targetBranchId, parsedOrgId]
      );

      if (branchRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Requested branch not found in your organization.' });
      }

      if (!branchRes.rows[0].is_active) {
        return res.status(403).json({ success: false, message: 'Requested branch is currently inactive.' });
      }

      if (!isOwner) {
        const assignmentRes = await db.query(
          `SELECT 1 FROM user_branches WHERE user_id = $1 AND branch_id = $2`,
          [userId, targetBranchId]
        );

        if (assignmentRes.rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You do not have assigned privileges for this branch.'
          });
        }
      }

      req.branchId = targetBranchId;
      req.branchName = branchRes.rows[0].name;
    } else {
      const assignedBranch = await db.query(
        `SELECT b.id, b.name 
         FROM branches b
         JOIN user_branches ub ON ub.branch_id = b.id
         WHERE ub.user_id = $1 AND b.organization_id = $2 AND b.deleted_at IS NULL AND b.is_active = TRUE
         LIMIT 1`,
        [userId, parsedOrgId]
      );

      if (assignedBranch.rows.length > 0) {
        req.branchId = assignedBranch.rows[0].id;
        req.branchName = assignedBranch.rows[0].name;
      } else if (isOwner) {
        const firstBranch = await db.query(
          `SELECT id, name FROM branches WHERE organization_id = $1 AND deleted_at IS NULL AND is_active = TRUE ORDER BY id ASC LIMIT 1`,
          [parsedOrgId]
        );
        req.branchId = firstBranch.rows[0]?.id || null;
        req.branchName = firstBranch.rows[0]?.name || null;
      } else {
        req.branchId = null;
      }
    }

    if (req.user) {
      req.user.orgId = req.orgId;
      req.user.branchId = req.branchId;
    }

    next();
  } catch (err) {
    console.error('Tenant Guard Failure:', err);
    return res.status(500).json({ success: false, message: 'Internal tenant authorization error.' });
  }
};