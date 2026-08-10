const asyncHandler = require('express-async-handler');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { getCourseProgressPercent } = require('../utils/courseProgress');

// Same single-vs-array multer/FormData quirk handled the same way as
// trainerAssignment.controller.js's toArray.
const toArray = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
};

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

// @desc    Assignments across every batch this student is currently
//          enrolled in, each with the student's own submission (if any)
//          attached — never another student's. `expired` is computed from
//          the server's own clock so the frontend never has to trust (or
//          even see) anyone's local time to decide whether upload is still
//          allowed.
// @route   GET /api/student/me/assignments
// @access  Private (STUDENT)
const getAssignments = asyncHandler(async (req, res) => {
  const student = req.student;

  const enrollments = await Enrollment.find({ student: student._id, status: 'enrolled' }).select('batch');
  const batchIds = enrollments.map((e) => e.batch);

  const assignments = await Assignment.find({ batch: { $in: batchIds } })
    .populate('course', 'name')
    .populate('batch', 'batchCode')
    .sort({ dueDate: 1, createdAt: -1 });

  const submissions = await Submission.find({
    assignment: { $in: assignments.map((a) => a._id) },
    student: student._id,
  });
  const submissionByAssignment = new Map(submissions.map((s) => [String(s.assignment), s]));

  const now = new Date();
  const data = assignments.map((a) => {
    const submission = submissionByAssignment.get(String(a._id));
    return {
      _id: a._id,
      title: a.title,
      description: a.description,
      topic: a.topic,
      dueDate: a.dueDate,
      referenceLinks: a.referenceLinks,
      referenceImages: a.referenceImages,
      attachments: a.attachments,
      courseName: a.course?.name,
      batchCode: a.batch?.batchCode,
      // Server-clock-derived, not left for the frontend to compute from a
      // possibly-wrong local clock — it only ever gates the UI, since the
      // real enforcement is submitAssignment's own check below.
      expired: Boolean(a.dueDate && now > a.dueDate),
      submission: submission
        ? {
            _id: submission._id,
            status: submission.status,
            submittedAt: submission.submittedAt,
            description: submission.description,
            files: submission.files,
            links: submission.links,
            feedback: submission.feedback,
          }
        : null,
    };
  });

  res.json({ success: true, data });
});

// @desc    Create or update (upsert — one submission per student per
//          assignment, same as the Submission model's unique index) the
//          caller's own submission for one assignment. Rejects with 403
//          once the deadline has passed, checked against `new Date()` (the
//          server's own clock) — never a client-supplied time, so this
//          can't be bypassed by a manipulated device clock. Enrollment in
//          the assignment's batch is verified the same way trainer routes
//          verify batch ownership: server-side, from req.student, never
//          trusting anything the client sends beyond the assignment id in
//          the URL.
// @route   POST /api/student/me/assignments/:assignmentId/submit
// @access  Private (STUDENT)
const submitAssignment = asyncHandler(async (req, res) => {
  const student = req.student;
  const assignment = await Assignment.findById(req.params.assignmentId);
  if (!assignment) {
    res.status(404);
    throw new Error('Assignment not found');
  }

  const enrollment = await Enrollment.findOne({ student: student._id, batch: assignment.batch, status: 'enrolled' });
  if (!enrollment) {
    res.status(403);
    throw new Error('Forbidden: you are not enrolled in this assignment');
  }

  if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
    res.status(403);
    throw new Error('Submission deadline has expired.');
  }

  const { description } = req.body;
  const links = toArray(req.body.links);
  const newFiles = (req.files || []).map((f) => `/uploads/${f.filename}`);

  let submission = await Submission.findOne({ assignment: assignment._id, student: student._id });
  if (submission) {
    if (description !== undefined) submission.description = description;
    if (links !== undefined) submission.links = links;
    if (newFiles.length) submission.files = [...submission.files, ...newFiles];
    submission.submittedAt = new Date();
    // A resubmission is new work — any previous review no longer applies
    // to what's now on file, so it goes back to pending rather than
    // keeping a stale Approved/Rejected badge and feedback on unreviewed
    // content.
    submission.status = 'pending';
    submission.feedback = undefined;
    submission.feedbackBy = undefined;
    submission.feedbackAt = undefined;
    await submission.save();
  } else {
    submission = await Submission.create({
      assignment: assignment._id,
      student: student._id,
      description,
      links: links || [],
      files: newFiles,
      submittedAt: new Date(),
    });
  }

  res.status(201).json({ success: true, data: submission });
});

module.exports = { getDashboard, getAssignments, submitAssignment };
