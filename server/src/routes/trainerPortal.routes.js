const express = require('express');
const {
  getDashboard,
  getCalendar,
  updateMyProfile,
  getCourseWorkspace,
  getCourseStudents,
  getCourseStudentDetail,
} = require('../controllers/trainerPortal.controller');
// Attendance roster is NOT reimplemented here — the exact same controller
// function the Admin-facing /api/attendance routes use is imported and
// reused as-is, with requireOwnBatch layered in front to scope it to the
// caller's own batch. Trainers are read-only on attendance — no mark/update
// route is exposed here at all (not just hidden in the UI).
const { getRoster } = require('../controllers/attendance.controller');
// Same reuse pattern for the trainer's own attendance (check-in/check-out)
// history — the exact controller the Admin-only /api/trainer-attendance
// route uses, reused as-is with the trainer id force-scoped below so it can
// never be pointed at another trainer's record.
const { getTrainerAttendance } = require('../controllers/trainerAttendance.controller');
const {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
  reviewSubmission,
  deleteSubmission,
} = require('../controllers/trainerAssignment.controller');
const {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  scheduleQuiz,
  unpublishQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getQuizProgress,
} = require('../controllers/trainerQuiz.controller');
const {
  getProgress,
  addModule,
  updateModule,
  deleteModule,
  addTopic,
  updateTopic,
  toggleTopic,
  deleteTopic,
} = require('../controllers/trainerProgress.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const { attachOwnTrainer, requireOwnBatch, requireOwnAssignment, requireOwnQuiz } = require('../middleware/trainerScope.middleware');
const { uploadDocument } = require('../middleware/upload.middleware');

const router = express.Router();
const uploadAssignmentFiles = uploadDocument.fields([
  { name: 'referenceImages', maxCount: 5 },
  { name: 'attachments', maxCount: 5 },
]);

// Every route here is the trainer's own data only — scoped server-side from
// req.user (never from a client-supplied id), gated behind the TRAINER role
// plus the matching permission module, and — for anything referencing a
// specific batch — additionally verified to actually belong to this
// trainer via requireOwnBatch. Never relies on the frontend to hide another
// trainer's data.
router.use(protect, authorize(ROLES.TRAINER), attachOwnTrainer);

router.get('/me/dashboard', checkPermission('dashboard', 'view'), getDashboard);
router.get('/me/calendar', checkPermission('dashboard', 'view'), getCalendar);
router.put('/me/profile', checkPermission('profile', 'update'), updateMyProfile);

router.get('/me/courses/:batchId', checkPermission('dashboard', 'view'), requireOwnBatch, getCourseWorkspace);
router.get('/me/courses/:batchId/students', checkPermission('students', 'view'), requireOwnBatch, getCourseStudents);
router.get(
  '/me/courses/:batchId/students/:studentId',
  checkPermission('students', 'view'),
  requireOwnBatch,
  getCourseStudentDetail
);

router.get('/me/attendance/roster', checkPermission('attendance', 'view'), requireOwnBatch, getRoster);
// The trainer's own attendance history — sidebar-level (not batch-scoped
// like the roster above), read-only. req.forceTrainerId (a plain req
// property, never req.query — see trainerAttendance.controller.js) pins
// the query to the caller's own record, the same guarantee requireOwnBatch
// gives the roster route above.
router.get(
  '/me/attendance-history',
  checkPermission('attendance', 'view'),
  (req, res, next) => {
    req.forceTrainerId = req.trainer._id;
    next();
  },
  getTrainerAttendance
);

router.get('/me/courses/:batchId/assignments', checkPermission('assignments', 'view'), requireOwnBatch, getAssignments);
router.post(
  '/me/courses/:batchId/assignments',
  checkPermission('assignments', 'create'),
  requireOwnBatch,
  uploadAssignmentFiles,
  createAssignment
);
router.put(
  '/me/assignments/:assignmentId',
  checkPermission('assignments', 'update'),
  requireOwnAssignment,
  uploadAssignmentFiles,
  updateAssignment
);
router.delete('/me/assignments/:assignmentId', checkPermission('assignments', 'delete'), requireOwnAssignment, deleteAssignment);

router.get(
  '/me/assignments/:assignmentId/submissions',
  checkPermission('assignments', 'view'),
  requireOwnAssignment,
  getSubmissions
);
router.put('/me/submissions/:submissionId/review', checkPermission('assignments', 'update'), reviewSubmission);
// Ownership (this submission's assignment belongs to the caller's own
// trainer) is verified inside the controller, the same pattern as review
// above — a submissionId isn't addressable via requireOwnAssignment since
// it isn't itself scoped under :assignmentId in this route.
router.delete('/me/submissions/:submissionId', checkPermission('assignments', 'delete'), deleteSubmission);

// Quizzes — CRUD + publish/schedule + question management, all scoped to
// the caller's own batch/quiz the same way assignments are above.
router.get('/me/courses/:batchId/quizzes', checkPermission('quizzes', 'view'), requireOwnBatch, getQuizzes);
router.post('/me/courses/:batchId/quizzes', checkPermission('quizzes', 'create'), requireOwnBatch, createQuiz);

router.get('/me/quizzes/:quizId', checkPermission('quizzes', 'view'), requireOwnQuiz, getQuiz);
router.put('/me/quizzes/:quizId', checkPermission('quizzes', 'update'), requireOwnQuiz, updateQuiz);
router.delete('/me/quizzes/:quizId', checkPermission('quizzes', 'delete'), requireOwnQuiz, deleteQuiz);

router.put('/me/quizzes/:quizId/publish', checkPermission('quizzes', 'update'), requireOwnQuiz, publishQuiz);
router.put('/me/quizzes/:quizId/schedule', checkPermission('quizzes', 'update'), requireOwnQuiz, scheduleQuiz);
router.put('/me/quizzes/:quizId/unpublish', checkPermission('quizzes', 'update'), requireOwnQuiz, unpublishQuiz);

router.post('/me/quizzes/:quizId/questions', checkPermission('quizzes', 'update'), requireOwnQuiz, addQuestion);
router.put('/me/quizzes/:quizId/questions/:questionId', checkPermission('quizzes', 'update'), requireOwnQuiz, updateQuestion);
router.delete('/me/quizzes/:quizId/questions/:questionId', checkPermission('quizzes', 'update'), requireOwnQuiz, deleteQuestion);

// Student-wise attempt/progress monitoring for one of this trainer's own
// quizzes — read-only (view permission only, same as getQuiz above), never
// exposes a way to edit a student's attempt count from here (no route for
// that exists anywhere in this file).
router.get('/me/quizzes/:quizId/progress', checkPermission('quizzes', 'view'), requireOwnQuiz, getQuizProgress);

// Course Progress — one curriculum (modules -> topics) per batch. Module/
// topic level routes aren't nested under :batchId (they're addressed by
// their own subdocument id instead) so ownership is verified inline in the
// controller rather than via a requireOwnBatch-style middleware.
router.get('/me/courses/:batchId/progress', checkPermission('progress', 'view'), requireOwnBatch, getProgress);
router.post('/me/courses/:batchId/progress/modules', checkPermission('progress', 'create'), requireOwnBatch, addModule);

router.put('/me/progress/modules/:moduleId', checkPermission('progress', 'update'), updateModule);
router.delete('/me/progress/modules/:moduleId', checkPermission('progress', 'delete'), deleteModule);
router.post('/me/progress/modules/:moduleId/topics', checkPermission('progress', 'create'), addTopic);

router.put('/me/progress/topics/:topicId', checkPermission('progress', 'update'), updateTopic);
router.patch('/me/progress/topics/:topicId/toggle', checkPermission('progress', 'update'), toggleTopic);
router.delete('/me/progress/topics/:topicId', checkPermission('progress', 'delete'), deleteTopic);

module.exports = router;
