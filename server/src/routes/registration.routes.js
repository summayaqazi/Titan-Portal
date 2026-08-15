const express = require('express');
const {
  getRegistrations,
  getRegistration,
  updateRegistrationStatus,
  logRegistrationVisit,
} = require('../controllers/registration.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

// Same shape as application.routes.js: both SUPER_ADMIN and ADMIN pass the
// coarse role gate, but Admin's seeded 'registrations' permissions are all
// false by default (see seed.js — unset, same as 'applications'), so
// checkPermission rejects every route below for Admin until a Super Admin
// explicitly grants it on the Roles & Permissions page. Never a
// client-trusted role check.
const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', checkPermission('registrations', 'view'), getRegistrations);
router.get('/:id', checkPermission('registrations', 'view'), getRegistration);
router.put('/:id', checkPermission('registrations', 'update'), updateRegistrationStatus);
// The Visitor API's entire surface — logs that the existing Review action
// opened this registration. Never a route for a separate Visitor page; see
// registration.controller.js's logRegistrationVisit.
router.post('/:id/visit', checkPermission('registrations', 'view'), logRegistrationVisit);

module.exports = router;
