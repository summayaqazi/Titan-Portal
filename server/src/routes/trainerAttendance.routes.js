const express = require('express');
const {
  getTrainerAttendance,
  checkIn,
  checkOut,
  verifyAttendance,
  deleteTrainerAttendance,
  scanTrainerAttendance,
} = require('../controllers/trainerAttendance.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

// Reuses the existing 'attendance' permission module (shared with student
// attendance) rather than introducing a new module across sidebar/roles UI.
router.get('/', checkPermission('attendance', 'view'), getTrainerAttendance);
router.post('/check-in', checkPermission('attendance', 'create'), checkIn);
router.post('/scan', checkPermission('attendance', 'create'), scanTrainerAttendance);
router.post('/:id/check-out', checkPermission('attendance', 'update'), checkOut);
router.patch('/:id/verify', checkPermission('attendance', 'update'), verifyAttendance);
router.delete('/:id', checkPermission('attendance', 'delete'), deleteTrainerAttendance);

module.exports = router;
