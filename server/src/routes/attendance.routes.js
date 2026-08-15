const express = require('express');
const {
  getRoster,
  markAttendance,
  multiMarkAttendance,
  scanStudentAttendance,
  getAttendance,
  deleteAttendance,
  lookupByRollNumber,
  getRecentActivity,
  getEnrollmentSummary,
} = require('../controllers/attendance.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/roster', checkPermission('attendance', 'view'), getRoster);
router.post('/mark', checkPermission('attendance', 'create'), markAttendance);
router.post('/multi-mark', checkPermission('attendance', 'create'), multiMarkAttendance);
router.post('/scan', checkPermission('attendance', 'create'), scanStudentAttendance);
router.get('/lookup', checkPermission('attendance', 'view'), lookupByRollNumber);
router.get('/recent', checkPermission('attendance', 'view'), getRecentActivity);
router.get('/summary/:enrollmentId', checkPermission('attendance', 'view'), getEnrollmentSummary);
router.get('/', checkPermission('attendance', 'view'), getAttendance);
router.delete('/:id', checkPermission('attendance', 'delete'), deleteAttendance);

module.exports = router;
