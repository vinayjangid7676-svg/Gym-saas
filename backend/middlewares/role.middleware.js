const db = require('../config/db');

// ================================================================
// 1. ROLE-BASED GUARD (High Performance + Fallback DB Verification)
// ================================================================
exports.authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      const orgId = req.user?.orgId || req.user?.org_id;

      if (!userId || !orgId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ya Organization session context missing hai.'
        });
      }

      // 1. Super Admin Full Bypass
      if (req.user?.isSuperAdmin || req.user?.is_super_admin) {
        return next();
      }

      const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase().trim());

      // 2. Fast Path: Token mein pehle se present role verify karein
      let userRoles = [];
      if (req.user?.role) {
        userRoles.push(String(req.user.role).toLowerCase().trim());
      }

      // 3. Fallback / Secure Path: Agar token mein role nahi hai ya fresh verification chahiye
      if (userRoles.length === 0) {
        const roleQuery = `
          SELECT r.slug 
          FROM roles r
          JOIN user_roles ur ON ur.role_id = r.id
          WHERE ur.user_id = $1 AND (r.organization_id = $2 OR r.organization_id IS NULL)
        `;
        const { rows } = await db.query(roleQuery, [userId, orgId]);

        if (rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Is user ko koi role assigned nahi hai.'
          });
        }

        userRoles = rows.map((r) => r.slug.toLowerCase().trim());
      }

      // 4. Authorization Evaluation
      const hasPermission = normalizedAllowed.some((role) => userRoles.includes(role));

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Is action ke liye [${allowedRoles.join(', ')}] role required hai. Aapka role "${userRoles.join(', ')}" hai.`
        });
      }

      req.userRoles = userRoles;
      next();
    } catch (error) {
      console.error('RBAC Authorize Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  };
};

// ================================================================
// 2. FINE-GRAINED PERMISSION GUARD (Module + Action Matrix)
// ================================================================
exports.checkPermission = (moduleName, actionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      const orgId = req.user?.orgId || req.user?.org_id;

      if (!userId || !orgId) {
        return res.status(401).json({ success: false, message: 'Unauthorized session.' });
      }

      // Super Admin bypass
      if (req.user?.isSuperAdmin || req.user?.is_super_admin) {
        return next();
      }

      const query = `
        SELECT 1
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        JOIN user_roles ur ON ur.role_id = rp.role_id
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1 
          AND (r.organization_id = $2 OR r.organization_id IS NULL)
          AND LOWER(p.module) = LOWER($3) 
          AND LOWER(p.action) = LOWER($4)
        LIMIT 1;
      `;
      const { rows } = await db.query(query, [userId, orgId, moduleName, actionName]);

      if (rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: Missing permission [${moduleName}.${actionName}]`
        });
      }

      next();
    } catch (error) {
      console.error('CheckPermission Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  };
};