const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Sirf Gym Owner aur Super Manager ko permission management ka access ho
router.use(authorizeRoles('owner', 'manager'));

router.get('/', roleController.getRoles);
router.get('/permissions', roleController.getPermissions);
router.post('/', roleController.createRole);
router.post('/assign', roleController.assignUserRole);

module.exports = router;