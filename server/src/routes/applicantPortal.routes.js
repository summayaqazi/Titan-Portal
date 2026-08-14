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
const { uploadApplicationFiles } = require('../middleware/upload.middleware');

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

// The applicant's own photo is now mandatory alongside the (still
// optional-unless-the-job-requires-it) resume — both accepted in one
// multipart request via uploadApplicationFiles (see upload.middleware.js),
// which routes each field to its own storage/type rules.
router.post(
  '/me/applications',
  checkPermission('applications', 'create'),
  uploadApplicationFiles.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
  ]),
  submitApplication
);

module.exports = router;
