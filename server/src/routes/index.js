const express = require('express');
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const cityRoutes = require('./city.routes');
const campusRoutes = require('./campus.routes');
const slotRoutes = require('./slot.routes');
const courseRoutes = require('./course.routes');
const batchRoutes = require('./batch.routes');
const trainerRoutes = require('./trainer.routes');
const trainerPortalRoutes = require('./trainerPortal.routes');
const studentRoutes = require('./student.routes');
const studentPortalRoutes = require('./studentPortal.routes');
const enrollmentRoutes = require('./enrollment.routes');
const attendanceRoutes = require('./attendance.routes');
const trainerAttendanceRoutes = require('./trainerAttendance.routes');
const paymentRoutes = require('./payment.routes');
const adminUserRoutes = require('./adminUser.routes');
const roleRoutes = require('./role.routes');
const publicRoutes = require('./public.routes');
const publicJobRoutes = require('./publicJob.routes');
const publicApplicantRoutes = require('./publicApplicant.routes');
const applicantPortalRoutes = require('./applicantPortal.routes');
const jobRoutes = require('./job.routes');
const applicationRoutes = require('./application.routes');
const registrationRoutes = require('./registration.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Public job browsing (Job Portal Phase 2) — mounted before the general
// '/public' route below so it's matched first; kept in its own isolated
// route/controller file (publicJob.routes.js) rather than added to
// public.routes.js, so the existing public course/registration flow is
// never touched.
router.use('/public/jobs', publicJobRoutes);

// Public Applicant account creation (Job Portal Phase 3) — same isolation
// reasoning as publicJob.routes.js above.
router.use('/public/applicant', publicApplicantRoutes);

// Public course discovery + registration/enrollment flow — the only other
// unauthenticated resource routes in the app. See public.routes.js.
router.use('/public', publicRoutes);

// Logged-in Applicant's own portal (Job Portal Phase 3 submission + Phase 4
// dashboard/tracking). Mirrors '/student' below.
router.use('/applicant', applicantPortalRoutes);

// Super Admin + Admin job management, and Super Admin application review/
// shortlist/approve/reject (Job Portal Phase 5). Same auth/permission
// layering as every other staff-facing resource below.
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/cities', cityRoutes);
router.use('/campuses', campusRoutes);
router.use('/slots', slotRoutes);
router.use('/courses', courseRoutes);
router.use('/batches', batchRoutes);
router.use('/trainers', trainerRoutes);
router.use('/trainer', trainerPortalRoutes);
router.use('/students', studentRoutes);
router.use('/student', studentPortalRoutes);
// Public course-registration review queue — deliberately its own resource,
// separate from '/students' above. See Registration.js's header comment.
router.use('/registrations', registrationRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/trainer-attendance', trainerAttendanceRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin-users', adminUserRoutes);
router.use('/roles', roleRoutes);

module.exports = router;
