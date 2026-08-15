const express = require('express');
const {
  getApplications,
  getApplication,
  updateApplicationStatus,
  downloadApplicationResume,
} = require('../controllers/application.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

// Same shape as job.routes.js: both SUPER_ADMIN and ADMIN pass the coarse
// role gate, but Admin's seeded 'applications' permissions are all false
// (see seed.js — untouched this phase), so checkPermission rejects every
// route below for Admin in practice. Never a client-trusted role check.
const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', checkPermission('applications', 'view'), getApplications);
router.get('/:id', checkPermission('applications', 'view'), getApplication);
router.get('/:id/resume', checkPermission('applications', 'export'), downloadApplicationResume);
router.put('/:id', checkPermission('applications', 'update'), updateApplicationStatus);

module.exports = router;
