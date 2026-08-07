const express = require('express');
const { updateEnrollment, bulkUpdateStatus, deleteEnrollment } = require('../controllers/enrollment.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

// Fixed-path route registered before the /:id routes below.
router.post('/bulk-status', checkPermission('updation', 'update'), bulkUpdateStatus);

router
  .route('/:id')
  .put(checkPermission('students', 'update'), updateEnrollment)
  .delete(checkPermission('students', 'delete'), deleteEnrollment);

module.exports = router;
