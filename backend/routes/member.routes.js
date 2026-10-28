const express = require('express');
const router = express.Router();
const memberController = require('../controllers/member.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { checkMemberLimit } = require('../middlewares/subscription.middleware');
const { uploadMemberPhoto } = require('../middlewares/upload.middleware');

// Sabhi member routes protected rahenge
router.use(authMiddleware);

// POST: Profile Image File Upload + Quota Verify + Member Create
router.post(
  '/',
  checkMemberLimit,
  uploadMemberPhoto.single('profile_image'),
  memberController.createMember
);

router.get('/', memberController.getMembers);
router.get('/:hash_id', memberController.getMemberByHashId);

// ✅ NAYA ROUTE: Existing member ki photo directly profile page se upload/change karne ke liye
router.post(
  '/:hash_id/photo',
  uploadMemberPhoto.single('profile_image'),
  memberController.uploadMemberPhoto
);

module.exports = router;