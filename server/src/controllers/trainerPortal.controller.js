const asyncHandler = require('express-async-handler');
const Batch = require('../models/Batch');
const Enrollment = require('../models/Enrollment');
const Assignment = require('../models/Assignment');
const { toTrainerProfile } = require('../utils/trainerProfile');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { getCourseProgressPercent } = require('../utils/courseProgress');

// Self-service endpoints for the logged-in Trainer's own portal (Dashboard,
// Calendar, Profile). Separate from trainer.controller.js, which is the
// existing Super Admin/Admin-facing CRUD over *other* trainers — this file
// never touches that one, and only ever reads/writes the caller's own
// Trainer document (resolved from req.user, never from a client-supplied
// id), so a trainer can never reach another trainer's data through it.
const ACTIVE_STATUSES = ['ongoing', 'upcoming'];
const ROSTER_STATUSES_EXCLUDED = ['rejected', 'cancelled', 'dropout', 'blacklisted'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// `date.toISOString()` converts to UTC first, which silently shifts the
// calendar date backwards for any server timezone ahead of UTC (local
// midnight is still "yesterday" in UTC) — always format from local date
// parts instead so the date string matches the actual local day being
// iterated.
const formatLocalDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dayInBatchRange = (date, batch) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  if (batch.startDate && day < new Date(new Date(batch.startDate).setHours(0, 0, 0, 0))) return false;
  if (batch.endDate && day > new Date(new Date(batch.endDate).setHours(23, 59, 59, 999))) return false;
  return true;
};

// @desc    Trainer's own dashboard — stats, upcoming teaching schedule, and
//          active course cards. Every number is a live query scoped to this
//          trainer's own batches; nothing here is hardcoded.
// @route   GET /api/trainer/me/dashboard
// @access  Private (TRAINER)
const getDashboard = asyncHandler(async (req, res) => {
  const trainer = req.trainer;

  const batches = await Batch.find({ trainer: trainer._id, status: { $in: ACTIVE_STATUSES } })
    .populate('course', 'name code durationInMonths')
    .populate('campus', 'name')
    .populate('slot', 'label days startTime endTime')
    .sort({ startDate: 1 });

  const activeBatches = batches.filter((b) => b.status === 'ongoing');
  const activeCourseIds = new Set(activeBatches.map((b) => b.course?._id?.toString()).filter(Boolean));

  const batchIds = activeBatches.map((b) => b._id);
  const [studentIds, totalAssignments] = await Promise.all([
    batchIds.length
      ? Enrollment.distinct('student', { batch: { $in: batchIds }, status: { $nin: ROSTER_STATUSES_EXCLUDED } })
      : Promise.resolve([]),
    Assignment.countDocuments({ trainer: trainer._id }),
  ]);

  const courseCards = await Promise.all(
    activeBatches.map(async (b) => {
      const [studentCount, progress] = await Promise.all([
        Enrollment.countDocuments({ batch: b._id, status: { $nin: ROSTER_STATUSES_EXCLUDED } }),
        // The Course Progress tab is the single source of truth — never a
        // time-elapsed estimate. Same course -> same number everywhere,
        // always current (nothing cached), always 0 until real topics are
        // marked complete.
        getCourseProgressPercent(b.course?._id),
      ]);
      return {
        batchId: b._id,
        courseId: b.course?._id,
        courseName: b.course?.name,
        campus: b.campus?.name,
        batchCode: b.batchCode,
        slot: b.slot ? { label: b.slot.label, days: b.slot.days, startTime: b.slot.startTime, endTime: b.slot.endTime } : null,
        progress,
        studentCount,
        startDate: b.startDate,
      };
    })
  );

  // Teaching schedule for the Dashboard's week strip — the exact same
  // Sun–Sat window the widget renders (see ScheduleWidget's `startOfWeek`),
  // not a rolling "next 7 days" — otherwise any real class day earlier in
  // the current week than today would never appear in `schedule` and the
  // widget would silently under-highlight a trainer's actual teaching days.
  const schedule = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dayName = DAY_NAMES[date.getDay()];
    batches.forEach((b) => {
      if (!b.slot?.days?.includes(dayName)) return;
      if (!dayInBatchRange(date, b)) return;
      schedule.push({
        date: formatLocalDate(date),
        day: dayName,
        courseName: b.course?.name,
        batchId: b._id,
        batchCode: b.batchCode,
        campus: b.campus?.name,
        slotLabel: b.slot?.label,
        startTime: b.slot?.startTime,
        endTime: b.slot?.endTime,
      });
    });
  }
  schedule.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  res.json({
    success: true,
    data: {
      stats: {
        activeCourses: activeCourseIds.size,
        totalStudents: studentIds.length,
        totalAssignments,
      },
      schedule,
      courses: courseCards,
    },
  });
});

// @desc    Trainer's own class calendar for a given month — every
//          occurrence of an assigned batch's slot days within that month.
// @route   GET /api/trainer/me/calendar?month=1-12&year=YYYY
// @access  Private (TRAINER)
const getCalendar = asyncHandler(async (req, res) => {
  const trainer = req.trainer;

  const now = new Date();
  const month = Math.min(Math.max(parseInt(req.query.month, 10) || now.getMonth() + 1, 1), 12);
  const year = parseInt(req.query.year, 10) || now.getFullYear();

  const batches = await Batch.find({ trainer: trainer._id, status: { $in: ACTIVE_STATUSES } })
    .populate('course', 'name code')
    .populate('campus', 'name')
    .populate('slot', 'label days startTime endTime');

  const daysInMonth = new Date(year, month, 0).getDate();
  const events = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayName = DAY_NAMES[date.getDay()];
    batches.forEach((b) => {
      if (!b.slot?.days?.includes(dayName)) return;
      if (!dayInBatchRange(date, b)) return;
      events.push({
        date: formatLocalDate(date),
        day: dayName,
        courseId: b.course?._id,
        courseName: b.course?.name,
        batchId: b._id,
        batchCode: b.batchCode,
        campus: b.campus?.name,
        slotLabel: b.slot?.label,
        startTime: b.slot?.startTime,
        endTime: b.slot?.endTime,
      });
    });
  }
  events.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  res.json({ success: true, data: { month, year, events } });
});

// @desc    Trainer-specific profile fields not covered by the shared
//          /auth/profile (name/phone/avatar — the Trainer portal's Profile
//          page reuses that same endpoint for those, and its own picture,
//          exactly like Super Admin/Admin do) or /auth/password.
// @route   PUT /api/trainer/me/profile
// @access  Private (TRAINER)
const updateMyProfile = asyncHandler(async (req, res) => {
  const trainer = req.trainer;

  const { bio, socialLinks } = req.body;

  if (bio !== undefined) trainer.bio = bio;
  if (socialLinks !== undefined) {
    trainer.socialLinks = {
      linkedin: socialLinks.linkedin ?? trainer.socialLinks?.linkedin,
      twitter: socialLinks.twitter ?? trainer.socialLinks?.twitter,
      facebook: socialLinks.facebook ?? trainer.socialLinks?.facebook,
      website: socialLinks.website ?? trainer.socialLinks?.website,
    };
  }

  await trainer.save();
  await trainer.populate('campuses', 'name');
  await trainer.populate('courses', 'name code');

  res.json({ success: true, data: toTrainerProfile(trainer) });
});

// @desc    Course Workspace header — course/batch/campus/slot info for the
//          breadcrumb + title. req.batch is already verified (by
//          requireOwnBatch) to belong to this trainer.
// @route   GET /api/trainer/me/courses/:batchId
// @access  Private (TRAINER)
const getCourseWorkspace = asyncHandler(async (req, res) => {
  const batch = await req.batch.populate([
    { path: 'course', select: 'name code durationInMonths' },
    { path: 'campus', select: 'name' },
    { path: 'slot', select: 'label days startTime endTime' },
  ]);

  const [studentCount, progress] = await Promise.all([
    Enrollment.countDocuments({ batch: batch._id, status: { $nin: ROSTER_STATUSES_EXCLUDED } }),
    getCourseProgressPercent(batch.course?._id),
  ]);

  res.json({
    success: true,
    data: {
      batchId: batch._id,
      batchCode: batch.batchCode,
      status: batch.status,
      course: batch.course,
      campus: batch.campus,
      slot: batch.slot,
      progress,
      studentCount,
      startDate: batch.startDate,
      endDate: batch.endDate,
    },
  });
});

// @desc    Students Tab — only students enrolled (via Enrollment) in this
//          trainer's own batch, never a direct Course-on-Student lookup.
// @route   GET /api/trainer/me/courses/:batchId/students?page=&limit=&search=
// @access  Private (TRAINER)
const getCourseStudents = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = { batch: req.batch._id };

  const enrollments = await Enrollment.find(filter)
    .populate({ path: 'student', populate: { path: 'user', select: 'name email phone avatar' } })
    .sort({ rollNumber: 1 });

  // Search is applied in-memory over the (already batch-scoped, typically
  // small) roster rather than a separate User query + $in, since there's no
  // direct student-search index needed at this scale.
  const term = search.toLowerCase();
  const filtered = term
    ? enrollments.filter(
        (e) =>
          e.student?.user?.name?.toLowerCase().includes(term) || e.student?.user?.email?.toLowerCase().includes(term)
      )
    : enrollments;

  const total = filtered.length;
  const items = filtered.slice(skip, skip + limit).map((e) => ({
    enrollmentId: e._id,
    studentId: e.student?._id,
    name: e.student?.user?.name,
    email: e.student?.user?.email,
    phone: e.student?.user?.phone,
    avatar: e.student?.user?.avatar,
    rollNumber: e.rollNumber,
    status: e.status,
    admissionDate: e.admissionDate,
  }));

  res.json(paginatedResponse({ items, total, page, limit }));
});

module.exports = { getDashboard, getCalendar, updateMyProfile, getCourseWorkspace, getCourseStudents };
