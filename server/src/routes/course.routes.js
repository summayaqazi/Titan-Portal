const express = require('express');
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/course.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router
  .route('/')
  .get(checkPermission('courses', 'view'), getCourses)
  .post(checkPermission('courses', 'create'), createCourse);
router
  .route('/:id')
  .get(checkPermission('courses', 'view'), getCourse)
  .put(checkPermission('courses', 'update'), updateCourse)
  .delete(checkPermission('courses', 'delete'), deleteCourse);

module.exports = router;
