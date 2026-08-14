const express = require('express');
const {
  getDashboard,
  getAssignments,
  submitAssignment,
  getProgress,
  getAttendance,
  markOwnAttendanceViaQr,
  getPayments,
  getQuizzes,
  getQuizInfo,
  startQuizAttempt,
  saveQuizAttemptProgress,
  submitQuizAttempt,
  getQuizAttempt,
  getCourseDetails,
  getMyProfile,
  updateMyProfile,
  submitFeedback,
} = require('../controllers/studentPortal.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const { attachOwnStudent } = require('../middleware/studentScope.middleware');
// `upload` (default export) is the image-only multer instance — used here
// for the profile picture, same as student.routes.js's Admin-facing
// upload.single('profilePicture'). `uploadDocument` is a property on that
// same module, already used for assignment submission files.
const upload = require('../middleware/upload.middleware');
const { uploadDocument } = require('../middleware/upload.middleware');

const router = express.Router();
const uploadSubmissionFiles = uploadDocument.array('files', 5);

// Every route here is the student's own data only — scoped server-side from
// req.user (never from a client-supplied id), gated behind the STUDENT role
// plus the matching permission module. Never relies on the frontend to hide
// another student's data. Phase 1 was Dashboard-only; Assignments (view +
// submit, with server-enforced deadlines) was Phase 2; Progress and
// Attendance (both read-only) were Phase 3; Payments (read-only) was
// Phase 4; Quiz + take-quiz-attempt flow was Phase 5; Course Details was
// Phase 6; Profile + Edit Profile was Phase 7; Feedback is Phase 8 — each
// following the exact same incremental approach the Trainer Portal used.
router.use(protect, authorize(ROLES.STUDENT), attachOwnStudent);

router.get('/me/dashboard', checkPermission('dashboard', 'view'), getDashboard);

// Phase 6 — Course Details, a read-only drill-down from a Dashboard course
// card. Gated on the 'dashboard' module (same sensitivity/read-only shape
// as Dashboard itself) rather than the 'courses' module — that module is
// the Admin-facing course *catalog* CRUD permission, a different concern
// than a student viewing their own enrollment. This mirrors the exact
// precedent already set by the Trainer Portal's own Course Workspace route
// (trainerModuleRoute('dashboard', 'courses/:batchId', ...) in App.jsx).
router.get('/me/courses/:enrollmentId', checkPermission('dashboard', 'view'), getCourseDetails);

// Phase 3 — Progress and Attendance, both read-only, following the same
// incremental approach as every prior phase.
router.get('/me/progress', checkPermission('progress', 'view'), getProgress);
router.get('/me/attendance', checkPermission('attendance', 'view'), getAttendance);
// Self-service "Scan QR" attendance — the ONE write this student-facing
// Attendance surface gets (everything else here stays read-only, per the
// Phase 3 comment above); gated on 'create' (a new grant — see the
// FIXUPS entry in seedStudentPortalPermissions.js) rather than 'update',
// since a student is only ever creating today's own record, never editing
// an existing one (markOwnAttendanceViaQr refuses to touch a record that
// already exists).
router.post('/me/attendance/scan', checkPermission('attendance', 'create'), markOwnAttendanceViaQr);

// Phase 4 — Payments, read-only. Deliberately NOT a forced-query reuse of
// payment.controller.js's getPayments (that function's `search` branch
// overwrites the student filter entirely — safe for an Admin-only route,
// but would let a student override their own scoping via a crafted query
// string). A small dedicated function is used instead, same as every other
// student-scoped read in this file.
router.get('/me/payments', checkPermission('payments', 'view'), getPayments);

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

// Phase 5 — Quiz + take-quiz-attempt flow. `/me/quiz-attempts/:attemptId...`
// is deliberately its own top-level path (not nested under
// `/me/quizzes/:quizId`) — nesting it there would collide with
// `/me/quizzes/:quizId` itself (both 3-segment paths), since "an attempt id"
// and "a quiz id" would otherwise occupy the exact same route slot. Ownership
// of a specific attempt (this student's, not another's) is verified inside
// submitQuizAttempt/getQuizAttempt themselves, same reasoning as the
// standalone `/me/submissions/:submissionId` routes in
// trainerPortal.routes.js.
router.get('/me/quizzes', checkPermission('quizzes', 'view'), getQuizzes);
router.get('/me/quizzes/:quizId', checkPermission('quizzes', 'view'), getQuizInfo);
router.post('/me/quizzes/:quizId/start', checkPermission('quizzes', 'create'), startQuizAttempt);
router.get('/me/quiz-attempts/:attemptId', checkPermission('quizzes', 'view'), getQuizAttempt);
// Autosave — same 'create' permission as starting/submitting an attempt
// (saving progress is part of the same "take the quiz" action), never
// 'update' (a student still can't touch anything about the quiz itself).
router.put('/me/quiz-attempts/:attemptId/progress', checkPermission('quizzes', 'create'), saveQuizAttemptProgress);
router.post('/me/quiz-attempts/:attemptId/submit', checkPermission('quizzes', 'create'), submitQuizAttempt);

// Phase 7 — Profile + Edit Profile. Student-level fields only (address,
// gender, date of birth, highest qualification, profile picture) — name/
// phone/avatar are edited via the existing shared PUT /auth/profile
// instead (see updateMyProfile's own comment for why). 'profile' is
// already a real permission module with STUDENT defaulted to
// {view:true, update:true} since Phase 1 — no permission-fixup script
// needed for this phase.
router.get('/me/profile', checkPermission('profile', 'view'), getMyProfile);
router.put('/me/profile', checkPermission('profile', 'update'), upload.single('profilePicture'), updateMyProfile);

// Phase 8 — Feedback. Create-only (no history/inbox view in this phase —
// see the 'feedback' permission entry in seed.js for why there's no
// matching 'view' grant). Reference images reuse the same image-only
// `upload` middleware/validation as the profile picture above, capped at
// 5 files matching the assignment-submission precedent.
router.post('/me/feedback', checkPermission('feedback', 'create'), upload.array('images', 5), submitFeedback);

module.exports = router;
