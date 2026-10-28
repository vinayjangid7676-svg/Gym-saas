const express = require('express');
const router = express.Router();
const planController = require('../controllers/plan.controller');

// ✅ Sahi filename import karein:
const { authorizeRoles } = require('../middlewares/role.middleware');

// View plans: Accessible to Owners, Managers, Receptionists, Trainers
router.get('/', planController.getPlans);

// Plan modifications: Restricted to Gym Owners and General Managers only
router.post('/', authorizeRoles('owner', 'manager'), planController.createPlan);
router.put('/:planIdentifier', authorizeRoles('owner', 'manager'), planController.updatePlan);
router.delete('/:planIdentifier', authorizeRoles('owner', 'manager'), planController.deletePlan);

module.exports = router;