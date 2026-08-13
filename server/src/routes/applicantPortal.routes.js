const express = require('express');
const {
  submitApplication,
  getDashboard,
  getMyApplications,
  getMyApplication,
  downloadMyResume,
} = require('../controllers/applicantPortal.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const { attachOwnApplicant } = require('../middleware/applicantScope.middleware');
const { uploadResume } = require('../middleware/upload.middleware');

// Every route here is the logged-in Applicant's own action only — scoped
// server-side via attachOwnApplicant (never from a client-supplied id),
// gated behind the APPLICANT role plus the 'applications' permission
// module (seeded in Phase 1 with view+create only). Mirrors
// studentPortal.routes.js's exact shape.
const router = express.Router();
router.use(protect, authorize(ROLES.APPLICANT), attachOwnApplicant);

// Phase 4 — Applicant Portal + Application Tracking (read-only).
router.get('/me/dashboard', checkPermission('applications', 'view'), getDashboard);
router.get('/me/applications', checkPermission('applications', 'view'), getMyApplications);
router.get('/me/applications/:id', checkPermission('applications', 'view'), getMyApplication);
router.get('/me/applications/:id/resume', checkPermission('applications', 'view'), downloadMyResume);

// Phase 3 — unchanged.
router.post('/me/applications', checkPermission('applications', 'create'), uploadResume.single('resume'), submitApplication);

module.exports = router;
