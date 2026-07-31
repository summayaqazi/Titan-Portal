const express = require('express');
const {
  getRoster,
  markAttendance,
  getAttendance,
  deleteAttendance,
} = require('../controllers/attendance.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.get('/roster', getRoster);
router.post('/mark', markAttendance);
router.get('/', getAttendance);
router.delete('/:id', deleteAttendance);

module.exports = router;
