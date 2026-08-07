const express = require('express');
const { getDashboard } = require('../controllers/studentPortal.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const { attachOwnStudent } = require('../middleware/studentScope.middleware');

const router = express.Router();

// Every route here is the student's own data only — scoped server-side from
// req.user (never from a client-supplied id), gated behind the STUDENT role
// plus the matching permission module. Never relies on the frontend to hide
// another student's data. Phase 1: Dashboard only — more tabs land in later
// phases, following the exact same incremental approach the Trainer Portal
// used (see trainerPortal.routes.js).
router.use(protect, authorize(ROLES.STUDENT), attachOwnStudent);

router.get('/me/dashboard', checkPermission('dashboard', 'view'), getDashboard);

module.exports = router;
