const express = require('express');
const {
  getStats,
  getCampusAnalytics,
  getCourseAnalytics,
} = require('../controllers/dashboard.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), checkPermission('dashboard', 'view'));

router.get('/stats', getStats);
router.get('/campus-analytics', getCampusAnalytics);
router.get('/course-analytics', getCourseAnalytics);

module.exports = router;
