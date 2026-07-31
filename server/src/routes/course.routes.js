const express = require('express');
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/course.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getCourses).post(createCourse);
router.route('/:id').get(getCourse).put(updateCourse).delete(deleteCourse);

module.exports = router;
