const express = require('express');
const { updateEnrollment, deleteEnrollment } = require('../controllers/enrollment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/:id').put(updateEnrollment).delete(deleteEnrollment);

module.exports = router;
