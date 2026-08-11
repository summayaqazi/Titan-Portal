const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const CourseProgress = require('../models/CourseProgress');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Feedback = require('../models/Feedback');
const { getCourseProgressPercent } = require('../utils/courseProgress');
// Reused as-is from the Trainer Portal's own progress/attendance/quiz
// controllers (all additively exported for this purpose) so the numbers
// shown to a student are always derived by the exact same logic already
// trusted for Trainer/Admin views — never a second implementation that
// could drift from theirs.
const { withComputed } = require('./trainerProgress.controller');
const { summarizeAttendance } = require('./attendance.controller');
const { syncSchedule } = require('./trainerQuiz.controller');

// The Quiz model (server/src/models/Quiz.js) has no passing-percentage
// field — verified by reading it, not assumed. Rather than add one (a
// schema change that, however small, touches a file the Trainer Portal's
// quiz management depends on), pass/fail is drawn with a single fixed
// threshold defined here, local to the Student Portal's own grading logic
// only. Zero risk to Trainer/Admin: nothing about how a quiz is created,
// edited, published, or scored by a trainer changes. If a per-quiz
// configurable threshold is wanted later, that's an additive Quiz.js field
// plus a Trainer-side control — out of scope for this phase.
const QUIZ_PASS_PERCENTAGE = 50;

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
    .populate({ path: 'campus', select: 'name city', populate: { path: 'city', select: 'name' } })
    .populate('slot', 'label days startTime endTime')
    .populate('batch', 'batchCode startDate endDate')
    .populate({ path: 'trainer', populate: { path: 'user', select: 'name' } })
    .sort({ admissionDate: -1 });

  const batchIds = enrollments.map((e) => e.batch?._id).filter(Boolean);

  // Assignment totals for the summary cards — same batch-scoping getAssignments
  // uses, just counted rather than returned in full, so the Dashboard's
  // "completed/total" figure is never a second, differently-scoped count.
  const assignmentIds = batchIds.length ? await Assignment.find({ batch: { $in: batchIds } }).distinct('_id') : [];

  const [attendanceRecords, pendingPayments, submittedAssignments] = await Promise.all([
    Attendance.find({ student: student._id }).select('status'),
    Payment.countDocuments({ student: student._id, status: { $in: ['pending', 'overdue'] } }),
    assignmentIds.length
      ? Submission.countDocuments({ assignment: { $in: assignmentIds }, student: student._id })
      : Promise.resolve(0),
  ]);

  const presentCount = attendanceRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendancePercent = attendanceRecords.length ? Math.round((presentCount / attendanceRecords.length) * 100) : 0;

  const courseCards = await Promise.all(
    enrollments.map(async (e) => ({
      enrollmentId: e._id,
      courseId: e.course?._id,
      courseName: e.course?.name,
      courseCode: e.course?.code,
      campus: e.campus?.name,
      city: e.campus?.city?.name,
      batchCode: e.batch?.batchCode,
      trainerName: e.trainer?.user?.name,
      slot: e.slot ? { label: e.slot.label, days: e.slot.days, startTime: e.slot.startTime, endTime: e.slot.endTime } : null,
      progress: await getCourseProgressPercent(e.course?._id),
      rollNumber: e.rollNumber,
      admissionDate: e.admissionDate,
      status: e.status,
    }))
  );

  // A single "Overall Progress" figure for the summary card — a plain
  // average of the same per-course percentages already computed above
  // (courseCards), never a separate calculation that could disagree with
  // what the Progress page or a course's own card shows.
  const overallProgressPercent = courseCards.length
    ? Math.round(courseCards.reduce((sum, c) => sum + c.progress, 0) / courseCards.length)
    : 0;

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
        // Raw counts alongside the existing percent — the redesigned
        // summary cards show "present/total" (e.g. "65/80"), same
        // convention as the Assignments figure below. `attendancePercent`
        // above is untouched, still derived from these same two numbers,
        // so nothing that already reads it is affected.
        attendancePresent: presentCount,
        attendanceTotal: attendanceRecords.length,
        assignmentsCompleted: submittedAssignments,
        assignmentsTotal: assignmentIds.length,
        overallProgressPercent,
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

// @desc    Read-only curriculum progress for every course the student is
//          currently enrolled in — module/topic completion and percentages,
//          derived by the same withComputed() the Trainer Portal's own
//          Course Progress tab uses, so the numbers can never disagree with
//          what a trainer sees for the same course. A course that has no
//          CourseProgress document yet (curriculum not built by a trainer
//          yet) simply reports 0 modules/0% — never a 404 — since that's a
//          normal, expected state, not an error.
// @route   GET /api/student/me/progress
// @access  Private (STUDENT)
const getProgress = asyncHandler(async (req, res) => {
  const student = req.student;

  const enrollments = await Enrollment.find({ student: student._id, status: 'enrolled' }).populate(
    'course',
    'name code'
  );

  const data = await Promise.all(
    enrollments.map(async (e) => {
      const progress = e.course ? await CourseProgress.findOne({ course: e.course._id }) : null;
      const computed = progress
        ? withComputed(progress)
        : { modules: [], totalTopics: 0, completedTopics: 0, remainingTopics: 0, progressPercent: 0 };
      return {
        enrollmentId: e._id,
        courseId: e.course?._id,
        courseName: e.course?.name,
        courseCode: e.course?.code,
        ...computed,
      };
    })
  );

  res.json({ success: true, data });
});

// @desc    Student's own attendance — top stats aggregated across every
//          enrolled course (via the same summarizeAttendance() helper the
//          Admin Attendance page's per-student summary uses) plus a
//          date-descending detail list, optionally narrowed to one calendar
//          month via ?month=YYYY-MM. Read-only: no mark/update route is
//          exposed anywhere in this file, exactly like the Trainer Portal
//          is read-only on its own roster.
// @route   GET /api/student/me/attendance?month=YYYY-MM
// @access  Private (STUDENT)
const getAttendance = asyncHandler(async (req, res) => {
  const student = req.student;

  const enrollments = await Enrollment.find({ student: student._id, status: 'enrolled' })
    .populate('course', 'name')
    .populate('batch', 'batchCode');

  const courseByBatch = new Map(
    enrollments.map((e) => [String(e.batch?._id), { courseName: e.course?.name, batchCode: e.batch?.batchCode }])
  );

  const summaries = await Promise.all(enrollments.map((e) => summarizeAttendance(e._id)));
  const stats = summaries.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.present += s.counts.present;
      acc.absent += s.counts.absent;
      acc.leave += s.counts.leave;
      acc.late += s.counts.late;
      return acc;
    },
    { total: 0, present: 0, absent: 0, leave: 0, late: 0 }
  );
  stats.percentPresent = stats.total ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;

  const filter = { student: student._id };
  // A strict YYYY-MM check keeps an unexpected query value from turning
  // into a bogus/NaN date range rather than silently returning everything.
  if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
    const [year, month] = req.query.month.split('-').map(Number);
    filter.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
  }
  const records = await Attendance.find(filter).sort({ date: -1 });
  const details = records.map((r) => ({
    _id: r._id,
    date: r.date,
    status: r.status,
    remarks: r.remarks,
    ...courseByBatch.get(String(r.batch)),
  }));

  res.json({ success: true, data: { stats, details } });
});

// @desc    Student's own fee/payment history — every Payment document
//          scoped to this student only (never another student's, and never
//          filterable to another student's — unlike the Admin-facing
//          getPayments in payment.controller.js, this route accepts no
//          search/query override of the student filter at all, by design).
//          Read-only: no create/update/delete route is exposed here, since
//          the backend has no student-initiated payment workflow yet — see
//          the Payment/Fee page's requirements (voucher id, status, due
//          date), all of which already exist on the Payment model as-is.
// @route   GET /api/student/me/payments
// @access  Private (STUDENT)
const getPayments = asyncHandler(async (req, res) => {
  const student = req.student;

  // `course.code`/`batch.batchCode` are newly populated here (same
  // Payment -> Enrollment -> Course/Batch relationship already in use
  // above, just two more `select`ed fields) so the Payments page can group
  // and badge each row by course without a second request or a new
  // endpoint — every existing field (courseName, feeType, month, amount,
  // dueDate, paidDate, invoiceNumber, status) is untouched.
  const payments = await Payment.find({ student: student._id })
    .populate({
      path: 'enrollment',
      populate: [
        { path: 'course', select: 'name code' },
        { path: 'batch', select: 'batchCode' },
      ],
    })
    .sort({ dueDate: -1, createdAt: -1 });

  const data = payments.map((p) => ({
    _id: p._id,
    enrollmentId: p.enrollment?._id,
    courseId: p.enrollment?.course?._id,
    courseName: p.enrollment?.course?.name,
    courseCode: p.enrollment?.course?.code,
    batchCode: p.enrollment?.batch?.batchCode,
    feeType: p.feeType,
    month: p.month,
    amount: p.amount,
    dueDate: p.dueDate,
    paidDate: p.paidDate,
    invoiceNumber: p.invoiceNumber,
    status: p.status,
  }));

  res.json({ success: true, data });
});

// Strips a question down to what's safe to send a student who can still
// attempt (or is currently attempting) the quiz — text/type/options/points
// only. `correctOptions` is never included here; the only place a
// question's correct answer ever factors in is server-side grading inside
// gradeAttempt() below, which reads it straight off the authoritative Quiz
// document, never off anything the client sent.
const sanitizeQuestion = (q) => ({
  _id: q._id,
  text: q.text,
  type: q.type,
  options: q.options,
  points: q.points,
});

// The one and only place a QuizAttempt's score/percentage/status are ever
// computed. `answers` is whatever the client submitted, already filtered
// (by the caller) down to question ids that actually belong to `quiz` — a
// question with no matching answer, or an answer set that doesn't exactly
// match `correctOptions`, simply scores 0 for that question. The client
// never supplies (and this function never reads) a score/percentage/status
// from the request — those three values are the server's alone to decide.
const gradeAttempt = (quiz, answers) => {
  const answerByQuestion = new Map(
    (answers || []).map((a) => [String(a.question), new Set((a.selectedOptions || []).map(Number))])
  );

  let score = 0;
  let correctCount = 0;
  quiz.questions.forEach((q) => {
    const selected = answerByQuestion.get(String(q._id));
    if (!selected) return;
    const correct = new Set(q.correctOptions);
    const isCorrect = selected.size === correct.size && [...selected].every((v) => correct.has(v));
    if (isCorrect) {
      score += q.points || 0;
      correctCount += 1;
    }
  });

  const totalMarks = quiz.totalMarks;
  const totalQuestions = quiz.questions.length;
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const status = percentage >= QUIZ_PASS_PERCENTAGE ? 'passed' : 'failed';
  return { score, correctCount, totalMarks, totalQuestions, percentage, status };
};

// @desc    Quizzes across every batch this student is currently enrolled
//          in — published only (a draft or not-yet-live scheduled quiz
//          isn't "legitimately available" to a student yet), each with
//          this student's own attempt history summarized. Never another
//          student's attempts.
// @route   GET /api/student/me/quizzes
// @access  Private (STUDENT)
const getQuizzes = asyncHandler(async (req, res) => {
  const student = req.student;

  const enrollments = await Enrollment.find({ student: student._id, status: 'enrolled' }).select('batch');
  const batchIds = enrollments.map((e) => e.batch);

  const quizzes = await Quiz.find({ batch: { $in: batchIds }, status: { $in: ['published', 'scheduled'] } })
    .populate('course', 'name')
    .sort({ createdAt: -1 });
  await Promise.all(quizzes.map(syncSchedule));
  const available = quizzes.filter((q) => q.status === 'published');

  const attempts = await QuizAttempt.find({
    student: student._id,
    quiz: { $in: available.map((q) => q._id) },
  }).sort({ attemptNumber: -1 });
  const attemptsByQuiz = new Map();
  attempts.forEach((a) => {
    const key = String(a.quiz);
    if (!attemptsByQuiz.has(key)) attemptsByQuiz.set(key, []);
    attemptsByQuiz.get(key).push(a);
  });

  const data = available.map((q) => {
    const quizAttempts = attemptsByQuiz.get(String(q._id)) || [];
    const latest = quizAttempts[0] || null;
    const graded = quizAttempts.filter((a) => a.status !== 'in-progress');
    const bestPercentage = graded.length ? Math.max(...graded.map((a) => a.percentage)) : null;

    return {
      _id: q._id,
      title: q.title,
      courseName: q.course?.name,
      totalQuestions: q.questions.length,
      durationMinutes: q.durationMinutes,
      totalMarks: q.totalMarks,
      attemptsCount: graded.length,
      latestAttempt: latest
        ? { status: latest.status, percentage: latest.percentage, score: latest.score, attemptNumber: latest.attemptNumber }
        : null,
      bestPercentage,
      // 'pending' (never attempted) | 'in-progress' (resumable attempt) |
      // 'passed' | 'failed' (latest graded attempt's own outcome).
      status: latest ? latest.status : 'pending',
    };
  });

  res.json({ success: true, data });
});

// @desc    One quiz's information panel — title, course, question/duration/
//          pass-mark facts, and this student's own attempt history. Never
//          includes question text or answer options (that's only ever
//          handed out once an attempt is actually started, via
//          startQuizAttempt below) — this is metadata only.
// @route   GET /api/student/me/quizzes/:quizId
// @access  Private (STUDENT)
const getQuizInfo = asyncHandler(async (req, res) => {
  const student = req.student;
  const quiz = await Quiz.findById(req.params.quizId).populate('course', 'name').populate('batch', 'batchCode');
  if (!quiz) {
    res.status(404);
    throw new Error('Quiz not found');
  }
  await syncSchedule(quiz);

  const enrollment = await Enrollment.findOne({ student: student._id, batch: quiz.batch?._id, status: 'enrolled' });
  if (!enrollment) {
    res.status(403);
    throw new Error('Forbidden: you are not enrolled in this quiz');
  }

  const attempts = await QuizAttempt.find({ student: student._id, quiz: quiz._id }).sort({ attemptNumber: -1 });
  const inProgress = attempts.find((a) => a.status === 'in-progress' && (!a.deadline || a.deadline > new Date()));

  res.json({
    success: true,
    data: {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      courseName: quiz.course?.name,
      batchCode: quiz.batch?.batchCode,
      status: quiz.status,
      totalQuestions: quiz.questions.length,
      totalMarks: quiz.totalMarks,
      durationMinutes: quiz.durationMinutes,
      passPercentage: QUIZ_PASS_PERCENTAGE,
      attempts: attempts.map((a) => ({
        attemptNumber: a.attemptNumber,
        status: a.status,
        score: a.score,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        late: a.late,
      })),
      hasInProgressAttempt: Boolean(inProgress),
      inProgressAttemptId: inProgress?._id,
    },
  });
});

// @desc    Start a new attempt, or resume the caller's own already-running
//          one for this quiz. Enrollment in the quiz's own batch is
//          verified server-side from req.student — never trusted from the
//          client — exactly like submitAssignment verifies enrollment
//          above. An expired-but-never-submitted prior attempt is closed
//          out (graded on whatever, possibly zero, answers it has) before
//          a fresh one is started, so a student can never accumulate
//          multiple simultaneous "in-progress" attempts at the same quiz.
//          The Quiz schema has no attempt-limit field (verified), so no
//          cap on the number of attempts is enforced here — only ever one
//          concurrently in-progress.
// @route   POST /api/student/me/quizzes/:quizId/start
// @access  Private (STUDENT)
const startQuizAttempt = asyncHandler(async (req, res) => {
  const student = req.student;
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) {
    res.status(404);
    throw new Error('Quiz not found');
  }
  await syncSchedule(quiz);
  if (quiz.status !== 'published') {
    res.status(403);
    throw new Error('This quiz is not currently available');
  }
  if (!quiz.questions.length) {
    res.status(400);
    throw new Error('This quiz has no questions yet');
  }

  const enrollment = await Enrollment.findOne({ student: student._id, batch: quiz.batch, status: 'enrolled' });
  if (!enrollment) {
    res.status(403);
    throw new Error('Forbidden: you are not enrolled in this quiz');
  }

  let attempt = await QuizAttempt.findOne({ student: student._id, quiz: quiz._id, status: 'in-progress' });

  if (attempt && attempt.deadline && new Date() > attempt.deadline) {
    const result = gradeAttempt(quiz, attempt.answers);
    Object.assign(attempt, result, { submittedAt: attempt.deadline, late: true });
    await attempt.save();
    attempt = null;
  }

  if (!attempt) {
    const priorAttempts = await QuizAttempt.countDocuments({ student: student._id, quiz: quiz._id });
    const startedAt = new Date();
    const deadline = quiz.durationMinutes ? new Date(startedAt.getTime() + quiz.durationMinutes * 60000) : null;
    attempt = await QuizAttempt.create({
      student: student._id,
      quiz: quiz._id,
      attemptNumber: priorAttempts + 1,
      startedAt,
      deadline,
    });
  }

  res.json({
    success: true,
    data: {
      attemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      deadline: attempt.deadline,
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        durationMinutes: quiz.durationMinutes,
        questions: quiz.questions.map(sanitizeQuestion),
      },
    },
  });
});

// @desc    Submit answers for the caller's own in-progress attempt. Ownership
//          (attempt.student === req.student) is verified before anything
//          else — the one guarantee that stops Student A from submitting,
//          or even discovering the existence of, Student B's attempt.
//          Already-submitted attempts are rejected (no silent
//          overwrite/duplicate grading). Score/percentage/status are
//          entirely server-computed from the authoritative Quiz document —
//          nothing of the kind is ever read from the request body.
// @route   POST /api/student/me/quiz-attempts/:attemptId/submit
// @access  Private (STUDENT)
const submitQuizAttempt = asyncHandler(async (req, res) => {
  const student = req.student;
  const attempt = await QuizAttempt.findById(req.params.attemptId);
  if (!attempt) {
    res.status(404);
    throw new Error('Attempt not found');
  }
  if (String(attempt.student) !== String(student._id)) {
    res.status(403);
    throw new Error('Forbidden: this attempt does not belong to you');
  }
  if (attempt.status !== 'in-progress') {
    res.status(400);
    throw new Error('This attempt has already been submitted');
  }

  const quiz = await Quiz.findById(attempt.quiz);
  if (!quiz) {
    res.status(404);
    throw new Error('Quiz not found');
  }

  const submittedAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];
  // Only answers referencing a question that actually belongs to this quiz
  // are kept — a question id for anything else is silently dropped rather
  // than trusted, since it arrives entirely from the client.
  const questionIds = new Set(quiz.questions.map((q) => String(q._id)));
  const cleanAnswers = submittedAnswers
    .filter((a) => a && questionIds.has(String(a.question)))
    .map((a) => ({
      question: a.question,
      selectedOptions: Array.isArray(a.selectedOptions) ? a.selectedOptions.map(Number).filter(Number.isInteger) : [],
    }));

  const late = Boolean(attempt.deadline) && new Date() > attempt.deadline;
  const result = gradeAttempt(quiz, cleanAnswers);

  attempt.answers = cleanAnswers;
  Object.assign(attempt, result);
  attempt.submittedAt = new Date();
  attempt.late = late;
  await attempt.save();

  res.json({
    success: true,
    data: {
      attemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      percentage: attempt.percentage,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      late: attempt.late,
    },
  });
});

// @desc    Re-fetch one of the caller's own past attempt results (e.g.
//          reopening a result after navigating away). Ownership-checked
//          the same way submitQuizAttempt is; never exposes answer
//          content/correctOptions, only the graded summary.
// @route   GET /api/student/me/quiz-attempts/:attemptId
// @access  Private (STUDENT)
const getQuizAttempt = asyncHandler(async (req, res) => {
  const student = req.student;
  const attempt = await QuizAttempt.findById(req.params.attemptId).populate('quiz', 'title');
  if (!attempt) {
    res.status(404);
    throw new Error('Attempt not found');
  }
  if (String(attempt.student) !== String(student._id)) {
    res.status(403);
    throw new Error('Forbidden: this attempt does not belong to you');
  }

  res.json({
    success: true,
    data: {
      attemptId: attempt._id,
      quizTitle: attempt.quiz?.title,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      percentage: attempt.percentage,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      late: attempt.late,
    },
  });
});

// @desc    Full detail view for ONE of the student's own enrollments —
//          course info, roll number/campus/city, this week's class
//          schedule (same Sun–Sat derivation getDashboard's schedule
//          widget already uses, scoped to just this one enrollment), and
//          curriculum progress (the exact same withComputed() derivation
//          getProgress above uses — never a second, possibly-conflicting
//          calculation). Looked up by enrollmentId, not courseId: a
//          student can hold more than one Enrollment for the same Course
//          (e.g. re-enrolling in a later batch — Enrollment's own unique
//          index is {student,course,batch}, not {student,course}), so
//          courseId alone can't unambiguously identify which enrollment to
//          show. This also matches how the Dashboard's own course cards
//          are already keyed (`enrollmentId`, see getDashboard above) —
//          the Course Details page is a drill-down from exactly those
//          cards. `Enrollment.findOne({_id, student})` combines the
//          existence and ownership checks into one query and one 404 for
//          both cases (mirrors getCourseStudentDetail's own precedent in
//          trainerPortal.controller.js), so a probing request can't tell
//          "no such enrollment" apart from "exists, but isn't yours".
// @route   GET /api/student/me/courses/:enrollmentId
// @access  Private (STUDENT)
const getCourseDetails = asyncHandler(async (req, res) => {
  const student = req.student;

  const enrollment = await Enrollment.findOne({ _id: req.params.enrollmentId, student: student._id })
    .populate('course', 'name code description durationInMonths')
    .populate({ path: 'campus', select: 'name city', populate: { path: 'city', select: 'name' } })
    .populate('slot', 'label days startTime endTime')
    .populate('batch', 'batchCode startDate endDate status')
    .populate({ path: 'trainer', populate: { path: 'user', select: 'name' } });

  if (!enrollment) {
    res.status(404);
    throw new Error('Course not found');
  }

  const schedule = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dayName = DAY_NAMES[date.getDay()];
    if (enrollment.slot?.days?.includes(dayName) && dayInBatchRange(date, enrollment.batch)) {
      schedule.push({
        date: formatLocalDate(date),
        day: dayName,
        slotLabel: enrollment.slot?.label,
        startTime: enrollment.slot?.startTime,
        endTime: enrollment.slot?.endTime,
      });
    }
  }

  const progressDoc = enrollment.course ? await CourseProgress.findOne({ course: enrollment.course._id }) : null;
  const progress = progressDoc
    ? withComputed(progressDoc)
    : { modules: [], totalTopics: 0, completedTopics: 0, remainingTopics: 0, progressPercent: 0 };

  res.json({
    success: true,
    data: {
      enrollmentId: enrollment._id,
      course: enrollment.course
        ? {
            _id: enrollment.course._id,
            name: enrollment.course.name,
            code: enrollment.course.code,
            description: enrollment.course.description,
            durationInMonths: enrollment.course.durationInMonths,
          }
        : null,
      status: enrollment.status,
      rollNumber: enrollment.rollNumber,
      admissionDate: enrollment.admissionDate,
      campus: enrollment.campus?.name,
      city: enrollment.campus?.city?.name,
      batchCode: enrollment.batch?.batchCode,
      batchStatus: enrollment.batch?.status,
      trainerName: enrollment.trainer?.user?.name,
      slot: enrollment.slot
        ? { label: enrollment.slot.label, days: enrollment.slot.days, startTime: enrollment.slot.startTime, endTime: enrollment.slot.endTime }
        : null,
      schedule,
      progress,
    },
  });
});

// @desc    The authenticated student's own profile — User-level fields
//          (name, email, phone — the same fields Super Admin/Admin/Trainer
//          already manage via GET /auth/me, just re-read here so the
//          Profile page doesn't need two separate requests) plus
//          Student-level fields (address, gender, date of birth, highest
//          qualification, CNIC + its verification state, profile picture)
//          and the student's own enrolled courses. CNIC is included for
//          display only — see updateMyProfile below for why it's never
//          accepted as an edit.
// @route   GET /api/student/me/profile
// @access  Private (STUDENT)
const getMyProfile = asyncHandler(async (req, res) => {
  const student = req.student;
  const user = req.user;

  const enrollments = await Enrollment.find({ student: student._id, status: 'enrolled' })
    .populate('course', 'name')
    .populate('batch', 'batchCode')
    .sort({ admissionDate: -1 });

  res.json({
    success: true,
    data: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: student.address,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      highestQualification: student.highestQualification,
      cnic: student.cnic,
      cnicVerified: student.cnicVerified,
      profilePicture: student.profilePicture,
      enrollments: enrollments.map((e) => ({
        enrollmentId: e._id,
        courseName: e.course?.name,
        batchCode: e.batch?.batchCode,
        status: e.status,
      })),
    },
  });
});

// @desc    Update the caller's own Student-level profile fields — address,
//          gender, date of birth, highest qualification, and profile
//          picture. Deliberately does NOT accept: name/phone (those already
//          have a safe, shared, unmodified endpoint — PUT /auth/profile,
//          used by every role — reused as-is from this same Edit Profile
//          form instead of being duplicated here); email (no email-
//          verification mechanism exists anywhere in this codebase, and
//          email is the login identity, so — like CNIC — it's treated as a
//          stable identity field a student can view but not self-change,
//          the same caution boundary the Admin-facing updateStudent already
//          draws around CNIC even though *it* is allowed to touch email);
//          CNIC (an identity/verification field — cnicVerified is an
//          Admin-only workflow via student.controller.js#verifyCnic, and
//          the existing architecture never extends CNIC editing to student
//          self-service, only to Admin); and role/permissions/ownership
//          (never read from req.body here at all, so there is no field for
//          a forged payload to even land on).
// @route   PUT /api/student/me/profile
// @access  Private (STUDENT)
const updateMyProfile = asyncHandler(async (req, res) => {
  const student = req.student;
  const { address, gender, dateOfBirth, highestQualification, removeProfilePicture } = req.body;

  // Validated against the Student schema's own enum definitions (not a
  // second hardcoded list that could silently drift from Student.js).
  const genderValues = student.schema.path('gender').enumValues;
  const qualificationValues = student.schema.path('highestQualification').enumValues;

  if (gender !== undefined) {
    if (gender && !genderValues.includes(gender)) {
      res.status(400);
      throw new Error(`Gender must be one of: ${genderValues.join(', ')}`);
    }
    student.gender = gender || undefined;
  }

  if (dateOfBirth !== undefined) {
    if (dateOfBirth) {
      const parsed = new Date(dateOfBirth);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400);
        throw new Error('Invalid date of birth');
      }
      if (parsed > new Date()) {
        res.status(400);
        throw new Error('Date of birth cannot be in the future');
      }
      student.dateOfBirth = parsed;
    } else {
      student.dateOfBirth = undefined;
    }
  }

  if (highestQualification !== undefined) {
    if (highestQualification && !qualificationValues.includes(highestQualification)) {
      res.status(400);
      throw new Error(`Highest qualification must be one of: ${qualificationValues.join(', ')}`);
    }
    student.highestQualification = highestQualification || undefined;
  }

  if (address !== undefined) {
    if (address.length > 500) {
      res.status(400);
      throw new Error('Address must be 500 characters or fewer');
    }
    student.address = address;
  }

  // Same upload-then-unlink-old-file pattern student.controller.js's own
  // (Admin-facing) updateStudent already uses for this exact field — kept
  // identical rather than reinvented, just triggered by the student
  // themself instead of an Admin.
  if (req.file) {
    if (student.profilePicture) {
      const oldPath = path.join(__dirname, '..', student.profilePicture.replace('/uploads/', 'uploads/'));
      fs.unlink(oldPath, () => {});
    }
    student.profilePicture = `/uploads/${req.file.filename}`;
  } else if (removeProfilePicture === 'true' && student.profilePicture) {
    const oldPath = path.join(__dirname, '..', student.profilePicture.replace('/uploads/', 'uploads/'));
    fs.unlink(oldPath, () => {});
    student.profilePicture = undefined;
  }

  await student.save();

  res.json({
    success: true,
    data: {
      address: student.address,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      highestQualification: student.highestQualification,
      profilePicture: student.profilePicture,
    },
  });
});

const FEEDBACK_TYPES = ['bug', 'idea', 'other'];

// @desc    Submit general product feedback (bug/idea/other) as the
//          authenticated account — never as a client-supplied identity.
//          req.user._id is the only identity ever written to the
//          document; nothing from req.body (studentId/userId/createdBy/
//          submittedBy/role/etc., even if present) is read for that
//          purpose.
// @route   POST /api/student/me/feedback
// @access  Private (STUDENT)
const submitFeedback = asyncHandler(async (req, res) => {
  const { type, message } = req.body;

  if (!type || !FEEDBACK_TYPES.includes(type)) {
    res.status(400);
    throw new Error(`Feedback type must be one of: ${FEEDBACK_TYPES.join(', ')}`);
  }
  if (!message || !message.trim()) {
    res.status(400);
    throw new Error('Feedback text is required');
  }
  if (message.length > 2000) {
    res.status(400);
    throw new Error('Feedback text must be 2000 characters or fewer');
  }

  const images = (req.files || []).map((f) => `/uploads/${f.filename}`);

  const feedback = await Feedback.create({
    user: req.user._id,
    type,
    message: message.trim(),
    images,
  });

  res.status(201).json({ success: true, data: feedback });
});

module.exports = {
  getDashboard,
  getAssignments,
  submitAssignment,
  getProgress,
  getAttendance,
  getPayments,
  getQuizzes,
  getQuizInfo,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizAttempt,
  getCourseDetails,
  getMyProfile,
  updateMyProfile,
  submitFeedback,
};
