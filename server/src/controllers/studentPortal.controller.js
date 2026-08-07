const asyncHandler = require('express-async-handler');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const { getCourseProgressPercent } = require('../utils/courseProgress');

// Self-service endpoints for the logged-in Student's own portal (Dashboard
// first — more tabs land in later phases). Separate from student.controller.js,
// which is the existing Super Admin/Admin-facing CRUD over *other* students —
// this file never touches that one, and only ever reads the caller's own
// Student document (resolved from req.user via attachOwnStudent, never from
// a client-supplied id), so a student can never reach another student's data
// through it. Mirrors trainerPortal.controller.js's shape/conventions.
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// `date.toISOString()` shifts the calendar date backwards for any server
// timezone ahead of UTC — always format from local date parts instead, same
// fix trainerPortal.controller.js already applies.
const formatLocalDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dayInBatchRange = (date, batch) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  if (batch?.startDate && day < new Date(new Date(batch.startDate).setHours(0, 0, 0, 0))) return false;
  if (batch?.endDate && day > new Date(new Date(batch.endDate).setHours(23, 59, 59, 999))) return false;
  return true;
};

// @desc    Student's own dashboard — enrollment/attendance/payment stats,
//          this week's class schedule, and active course cards. Every
//          number is a live query scoped to this student's own enrollments;
//          nothing here is hardcoded.
// @route   GET /api/student/me/dashboard
// @access  Private (STUDENT)
const getDashboard = asyncHandler(async (req, res) => {
  const student = req.student;

  const enrollments = await Enrollment.find({ student: student._id, status: 'enrolled' })
    .populate('course', 'name code')
    .populate('campus', 'name')
    .populate('slot', 'label days startTime endTime')
    .populate('batch', 'batchCode startDate endDate')
    .populate({ path: 'trainer', populate: { path: 'user', select: 'name' } })
    .sort({ admissionDate: -1 });

  const [attendanceRecords, pendingPayments] = await Promise.all([
    Attendance.find({ student: student._id }).select('status'),
    Payment.countDocuments({ student: student._id, status: { $in: ['pending', 'overdue'] } }),
  ]);

  const presentCount = attendanceRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendancePercent = attendanceRecords.length ? Math.round((presentCount / attendanceRecords.length) * 100) : 0;

  const courseCards = await Promise.all(
    enrollments.map(async (e) => ({
      enrollmentId: e._id,
      courseId: e.course?._id,
      courseName: e.course?.name,
      campus: e.campus?.name,
      batchCode: e.batch?.batchCode,
      trainerName: e.trainer?.user?.name,
      slot: e.slot ? { label: e.slot.label, days: e.slot.days, startTime: e.slot.startTime, endTime: e.slot.endTime } : null,
      progress: await getCourseProgressPercent(e.course?._id),
      rollNumber: e.rollNumber,
      admissionDate: e.admissionDate,
    }))
  );

  // This week's class schedule (Sun–Sat), same window/derivation trainerPortal
  // uses for its own Teaching Schedule widget — every enrolled batch's slot
  // days, bounded to the batch's own start/end date.
  const schedule = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dayName = DAY_NAMES[date.getDay()];
    enrollments.forEach((e) => {
      if (!e.slot?.days?.includes(dayName)) return;
      if (!dayInBatchRange(date, e.batch)) return;
      schedule.push({
        date: formatLocalDate(date),
        day: dayName,
        courseName: e.course?.name,
        batchCode: e.batch?.batchCode,
        campus: e.campus?.name,
        slotLabel: e.slot?.label,
        startTime: e.slot?.startTime,
        endTime: e.slot?.endTime,
      });
    });
  }
  schedule.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  res.json({
    success: true,
    data: {
      stats: {
        enrolledCourses: enrollments.length,
        attendancePercent,
        pendingPayments,
      },
      schedule,
      courses: courseCards,
    },
  });
});

module.exports = { getDashboard };
