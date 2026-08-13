const express = require('express');
const { getJobs, getJob, createJob, updateJob, deleteJob } = require('../controllers/job.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

// Super Admin + Admin (Campus Admin) job management. Same shape as
// course.routes.js: both roles pass the coarse `authorize` role gate, then
// `checkPermission` narrows per action based on each role's actual seeded
// grants (Admin has view+create+update+delete on 'jobs' — see seed.js —
// but update/delete are further restricted to jobs they created, enforced
// inside job.controller.js, not here).
const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router
  .route('/')
  .get(checkPermission('jobs', 'view'), getJobs)
  .post(checkPermission('jobs', 'create'), createJob);
router
  .route('/:id')
  .get(checkPermission('jobs', 'view'), getJob)
  .put(checkPermission('jobs', 'update'), updateJob)
  .delete(checkPermission('jobs', 'delete'), deleteJob);

module.exports = router;
