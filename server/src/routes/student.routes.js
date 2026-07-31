const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/student.controller');
const { getStudentEnrollments, createEnrollment } = require('../controllers/enrollment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const upload = require('../middleware/upload.middleware');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getStudents).post(upload.single('profilePicture'), createStudent);
router
  .route('/:id')
  .get(getStudent)
  .put(upload.single('profilePicture'), updateStudent)
  .delete(deleteStudent);

router.route('/:studentId/enrollments').get(getStudentEnrollments).post(createEnrollment);

module.exports = router;
