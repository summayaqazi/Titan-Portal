const express = require('express');
const { registerApplicant } = require('../controllers/publicApplicant.controller');

// Public, unauthenticated Applicant account creation. Isolated from every
// other public route file, same reasoning as publicJob.routes.js in Phase 2.
const router = express.Router();

router.post('/register', registerApplicant);

module.exports = router;
