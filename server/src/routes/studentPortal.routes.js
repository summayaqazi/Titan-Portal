const express = require('express');
const { getDashboard, getAssignments, submitAssignment } = require('../controllers/studentPortal.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const { attachOwnStudent } = require('../middleware/studentScope.middleware');
const { uploadDocument } = require('../middleware/upload.middleware');

const router = express.Router();
const uploadSubmissionFiles = uploadDocument.array('files', 5);

// Every route here is the student's own data only — scoped server-side from
// req.user (never from a client-supplied id), gated behind the STUDENT role
// plus the matching permission module. Never relies on the frontend to hide
// another student's data. Phase 1 was Dashboard-only; Assignments (view +
// submit, with server-enforced deadlines) is the next phase, following the
// exact same incremental approach the Trainer Portal used.
router.use(protect, authorize(ROLES.STUDENT), attachOwnStudent);

router.get('/me/dashboard', checkPermission('dashboard', 'view'), getDashboard);

router.get('/me/assignments', checkPermission('assignments', 'view'), getAssignments);
// Deadline + enrollment are both verified inside submitAssignment itself
// (not a route-level middleware) — same pattern reviewSubmission/
// deleteSubmission use in trainerPortal.routes.js for a resource that
// isn't itself nested under a pre-verified parent id.
router.post(
  '/me/assignments/:assignmentId/submit',
  checkPermission('assignments', 'create'),
  uploadSubmissionFiles,
  submitAssignment
);

module.exports = router;
