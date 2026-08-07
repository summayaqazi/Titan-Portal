const express = require('express');
const {
  getRoleSummary,
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/role.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

// Fixed-path routes must be registered before the /:id routes below,
// otherwise Express would match "summary" as an :id lookup.
router.get('/summary', getRoleSummary);

router
  .route('/')
  .get(checkPermission('rolesPermissions', 'view'), getRoles)
  .post(checkPermission('rolesPermissions', 'create'), createRole);
router
  .route('/:id')
  .get(checkPermission('rolesPermissions', 'view'), getRole)
  .put(checkPermission('rolesPermissions', 'update'), updateRole)
  .delete(checkPermission('rolesPermissions', 'delete'), deleteRole);

module.exports = router;
