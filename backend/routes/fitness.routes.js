const express = require('express');
const router = express.Router();
const fitnessController = require('../controllers/fitness.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// GET Routes (UI Data Loading)
router.get('/member/:memberId/overview', fitnessController.getMemberFitnessOverview);
router.get('/exercises', fitnessController.getExercises);
router.get('/diet-catalog', fitnessController.getDietCatalog);

// POST Management Routes (Trainer, Manager, Owner Access)
router.use(authorizeRoles('owner', 'manager', 'trainer'));

// Health & Measurements (Section 7)
router.post('/health-profile', fitnessController.saveHealthProfile);
router.post('/measurements', fitnessController.recordMeasurements);

// Workout Library & Plans (Section 8)
router.post('/exercises', fitnessController.createExercise);
router.post('/workout-plans', fitnessController.createMemberWorkoutPlan);
router.post('/workout-logs', fitnessController.logWorkout);

// Diet & Nutrition (Section 9)
router.post('/foods', fitnessController.createFood);
router.post('/diet-plans', fitnessController.createDietPlan);
router.post('/diet-plans/assign', fitnessController.assignDietToMember);

module.exports = router;