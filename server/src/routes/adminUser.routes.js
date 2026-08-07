const express = require('express');
const {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} = require('../controllers/adminUser.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router
  .route('/')
  .get(checkPermission('adminUsers', 'view'), getAdminUsers)
  .post(checkPermission('adminUsers', 'create'), createAdminUser);
router
  .route('/:id')
  .put(checkPermission('adminUsers', 'update'), updateAdminUser)
  .delete(checkPermission('adminUsers', 'delete'), deleteAdminUser);

module.exports = router;
