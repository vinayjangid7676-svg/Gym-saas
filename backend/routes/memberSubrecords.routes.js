const express = require('express');
const router = express.Router();
const subController = require('../controllers/memberSubrecords.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// ─── GET SUBRECORDS DATA FOR A MEMBER ───
router.get(
  '/members/:member_id',
  authorizeRoles('owner', 'manager', 'receptionist', 'trainer'),
  subController.getMemberSubrecords
);

// ─── ADMINISTRATIVE & CRM (Trainer Blocked) ───
router.post('/emergency-contacts', authorizeRoles('owner', 'manager', 'receptionist'), subController.addEmergencyContact);
router.post('/documents', authorizeRoles('owner', 'manager', 'receptionist'), subController.addMemberDocument);
router.post('/memberships/renew', authorizeRoles('owner', 'manager', 'receptionist'), subController.renewMembership);
router.post('/leads/status', authorizeRoles('owner', 'manager', 'receptionist'), subController.updateLeadStatus);
router.post('/leads/activity', authorizeRoles('owner', 'manager', 'receptionist'), subController.logLeadActivity);

// ─── FITNESS & HEALTH ASSESSMENTS (Trainer Allowed) ───
router.post('/notes', authorizeRoles('owner', 'manager', 'trainer'), subController.addMemberNote);
router.post('/tags', authorizeRoles('owner', 'manager', 'trainer'), subController.createAndAssignTag);
router.post('/health/conditions', authorizeRoles('owner', 'manager', 'trainer'), subController.addMedicalCondition);
router.post('/health/injuries', authorizeRoles('owner', 'manager', 'trainer'), subController.addInjury);
router.post('/health/goals', authorizeRoles('owner', 'manager', 'trainer'), subController.addGoal);
router.post('/health/composition', authorizeRoles('owner', 'manager', 'trainer'), subController.addBodyComposition);

module.exports = router;