const express = require('express');
const { getJobs, getJob, createJob, updateJob, deleteJob } = require('../controllers/job.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
// Same public, 2MB, image-only multer instance already used for User
// avatars/Student/Trainer profile pictures — job posting images are public
// (shown on the unauthenticated Jobs/Job Details pages), so this is never
// the private uploadResume storage.
const upload = require('../middleware/upload.middleware');

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
  .post(checkPermission('jobs', 'create'), upload.single('image'), createJob);
router
  .route('/:id')
  .get(checkPermission('jobs', 'view'), getJob)
  // upload.single('image') is a no-op for the lightweight Publish/Unpublish/
  // Close/Reopen status-only PUT (plain JSON, no file part) — multer only
  // engages for an actual multipart/form-data request, same as every other
  // route in this app that mixes both call shapes on one endpoint.
  .put(checkPermission('jobs', 'update'), upload.single('image'), updateJob)
  .delete(checkPermission('jobs', 'delete'), deleteJob);

module.exports = router;
