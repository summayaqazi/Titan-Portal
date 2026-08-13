const express = require('express');
const { getPublicJobs, getPublicJob } = require('../controllers/publicJob.controller');

// Public, unauthenticated job browsing routes — isolated from
// public.routes.js (the existing public course/registration flow) per the
// Job Portal Phase 2 instruction to keep this fully separate rather than
// edit that already-shipped file. No `protect` middleware, same as
// public.routes.js's own pattern.
const router = express.Router();

router.get('/', getPublicJobs);
router.get('/:id', getPublicJob);

module.exports = router;
