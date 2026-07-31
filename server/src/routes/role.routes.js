const express = require('express');
const { getRoleSummary } = require('../controllers/role.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.get('/summary', getRoleSummary);

module.exports = router;
