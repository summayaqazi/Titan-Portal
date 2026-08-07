const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  verifyCnic,
  getStudentAuditPdf,
  exportStudents,
} = require('../controllers/student.controller');
const { getStudentEnrollments, createEnrollment } = require('../controllers/enrollment.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const upload = require('../middleware/upload.middleware');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

// Fixed-path route registered before the /:id routes below.
router.get('/export', checkPermission('students', 'export'), exportStudents);

router
  .route('/')
  .get(checkPermission('students', 'view'), getStudents)
  .post(checkPermission('students', 'create'), upload.single('profilePicture'), createStudent);
router
  .route('/:id')
  .get(checkPermission('students', 'view'), getStudent)
  .put(checkPermission('students', 'update'), upload.single('profilePicture'), updateStudent)
  .delete(checkPermission('students', 'delete'), deleteStudent);

router.patch('/:id/verify-cnic', checkPermission('students', 'update'), verifyCnic);
router.get('/:id/audit-pdf', checkPermission('students', 'export'), getStudentAuditPdf);

router
  .route('/:studentId/enrollments')
  .get(checkPermission('students', 'view'), getStudentEnrollments)
  .post(checkPermission('students', 'update'), createEnrollment);

module.exports = router;
