const express = require('express');
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const cityRoutes = require('./city.routes');
const campusRoutes = require('./campus.routes');
const slotRoutes = require('./slot.routes');
const courseRoutes = require('./course.routes');
const batchRoutes = require('./batch.routes');
const trainerRoutes = require('./trainer.routes');
const studentRoutes = require('./student.routes');
const enrollmentRoutes = require('./enrollment.routes');
const attendanceRoutes = require('./attendance.routes');
const paymentRoutes = require('./payment.routes');
const adminUserRoutes = require('./adminUser.routes');
const roleRoutes = require('./role.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/cities', cityRoutes);
router.use('/campuses', campusRoutes);
router.use('/slots', slotRoutes);
router.use('/courses', courseRoutes);
router.use('/batches', batchRoutes);
router.use('/trainers', trainerRoutes);
router.use('/students', studentRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin-users', adminUserRoutes);
router.use('/roles', roleRoutes);

module.exports = router;
