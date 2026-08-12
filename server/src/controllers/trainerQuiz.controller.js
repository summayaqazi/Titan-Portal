const asyncHandler = require('express-async-handler');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Enrollment = require('../models/Enrollment');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { MAX_QUIZ_ATTEMPTS, closeExpiredAttempt, getQuizAvailability } = require('../utils/quizGrading');

const QUESTION_TYPES = ['single', 'multiple', 'true-false'];

const recomputeTotalMarks = (quiz) => {
  quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.points || 0), 0);
};

// Validates the optional start/end availability window shared by
// createQuiz/updateQuiz. Both are optional (see Quiz.js's own comment on
// why), but if either is given it must be a real date, and an end given
// without a start (or vice versa) — or an end at/before its start — is
// rejected rather than silently accepted as a nonsensical window.
// Returns { error } or { value: { startAt, endAt } } (values are `undefined`
// for whichever side wasn't provided, so callers can `Object.assign`/set
// only what's present without clobbering the other side on an update).
const parseAvailabilityWindow = ({ startAt, endAt }) => {
  const value = {};
  if (startAt !== undefined) {
    if (startAt === null || startAt === '') {
      value.startAt = null;
    } else {
      const d = new Date(startAt);
      if (Number.isNaN(d.getTime())) return { error: 'Invalid quiz start date/time' };
      value.startAt = d;
    }
  }
  if (endAt !== undefined) {
    if (endAt === null || endAt === '') {
      value.endAt = null;
    } else {
      const d = new Date(endAt);
      if (Number.isNaN(d.getTime())) return { error: 'Invalid quiz end date/time' };
      value.endAt = d;
    }
  }
  return { value };
};

// Cross-field check run after merging the incoming values onto the quiz (so
// it sees the final start/end pair regardless of whether this request
// touched one, both, or neither) — an end date must be strictly after the
// start date whenever both are actually set.
const validateWindowOrder = (quiz) => {
  if (quiz.startAt && quiz.endAt && quiz.endAt <= quiz.startAt) {
    return 'Quiz end date/time must be after the start date/time';
  }
  return null;
};

// A 'scheduled' quiz has no cron flipping it live — instead, whenever one is
// read (list or detail) and its scheduledAt has passed, it's flipped to
// 'published' right here and persisted, so the stored status never lags
// behind reality by more than one request.
const syncSchedule = async (quiz) => {
  if (quiz.status === 'scheduled' && quiz.scheduledAt && quiz.scheduledAt <= new Date()) {
    quiz.status = 'published';
    quiz.publishedAt = quiz.scheduledAt;
    await quiz.save();
  }
  return quiz;
};

// Validates one question's shape and normalizes its options/correctOptions.
// Returns { error } or { value }.
const normalizeQuestion = ({ text, type = 'single', options, correctOptions, points }) => {
  if (!text || !text.trim()) return { error: 'Question text is required' };
  if (!QUESTION_TYPES.includes(type)) return { error: 'Invalid question type' };

  const opts = type === 'true-false' ? ['True', 'False'] : (options || []).map((o) => o.trim()).filter(Boolean);
  if (opts.length < 2) return { error: 'At least 2 options are required' };

  const correct = [...new Set((correctOptions || []).map(Number))].filter(
    (n) => Number.isInteger(n) && n >= 0 && n < opts.length
  );
  if (!correct.length) return { error: 'Select at least one correct option' };
  if (type !== 'multiple' && correct.length > 1) return { error: 'Only one correct option is allowed for this question type' };

  return { value: { text: text.trim(), type, options: opts, correctOptions: correct, points: points > 0 ? points : 1 } };
};

// @desc    List this trainer's quizzes for one batch.
// @route   GET /api/trainer/me/courses/:batchId/quizzes?page=&limit=&search=
// @access  Private (TRAINER)
const getQuizzes = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = { batch: req.batch._id };
  if (search) filter.title = { $regex: search, $options: 'i' };

  const [items, total] = await Promise.all([
    Quiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quiz.countDocuments(filter),
  ]);
  await Promise.all(items.map(syncSchedule));

  res.json(paginatedResponse({ items, total, page, limit }));
});

// @desc    Get one quiz (with its full question list).
// @route   GET /api/trainer/me/quizzes/:quizId
// @access  Private (TRAINER)
const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await syncSchedule(req.quiz);
  res.json({ success: true, data: quiz });
});

// @desc    Create a quiz (starts as a draft) for this trainer's own batch.
// @route   POST /api/trainer/me/courses/:batchId/quizzes
// @access  Private (TRAINER)
const createQuiz = asyncHandler(async (req, res) => {
  const { title, description, durationMinutes } = req.body;
  if (!title || !title.trim()) {
    res.status(400);
    throw new Error('Title is required');
  }

  const { error: windowError, value: window } = parseAvailabilityWindow(req.body);
  if (windowError) {
    res.status(400);
    throw new Error(windowError);
  }

  const quiz = new Quiz({
    title: title.trim(),
    description,
    durationMinutes: durationMinutes || 30,
    course: req.batch.course,
    batch: req.batch._id,
    trainer: req.trainer._id,
    startAt: window.startAt || undefined,
    endAt: window.endAt || undefined,
  });

  const orderError = validateWindowOrder(quiz);
  if (orderError) {
    res.status(400);
    throw new Error(orderError);
  }

  await quiz.save();
  res.status(201).json({ success: true, data: quiz });
});

// @desc    Update a quiz's own fields. req.quiz is already ownership-verified.
// @route   PUT /api/trainer/me/quizzes/:quizId
// @access  Private (TRAINER)
const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = req.quiz;
  const { title, description, durationMinutes } = req.body;

  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      throw new Error('Title is required');
    }
    quiz.title = title.trim();
  }
  if (description !== undefined) quiz.description = description;
  if (durationMinutes !== undefined) quiz.durationMinutes = durationMinutes;

  const { error: windowError, value: window } = parseAvailabilityWindow(req.body);
  if (windowError) {
    res.status(400);
    throw new Error(windowError);
  }
  if ('startAt' in window) quiz.startAt = window.startAt || undefined;
  if ('endAt' in window) quiz.endAt = window.endAt || undefined;

  const orderError = validateWindowOrder(quiz);
  if (orderError) {
    res.status(400);
    throw new Error(orderError);
  }

  await quiz.save();
  res.json({ success: true, data: quiz });
});

// @desc    Delete a quiz.
// @route   DELETE /api/trainer/me/quizzes/:quizId
// @access  Private (TRAINER)
const deleteQuiz = asyncHandler(async (req, res) => {
  await req.quiz.deleteOne();
  res.json({ success: true, message: 'Quiz deleted' });
});

// @desc    Publish a quiz immediately — makes it live right now.
// @route   PUT /api/trainer/me/quizzes/:quizId/publish
// @access  Private (TRAINER)
const publishQuiz = asyncHandler(async (req, res) => {
  const quiz = req.quiz;
  if (!quiz.questions.length) {
    res.status(400);
    throw new Error('Add at least one question before publishing');
  }
  quiz.status = 'published';
  quiz.publishedAt = new Date();
  quiz.scheduledAt = undefined;
  await quiz.save();
  res.json({ success: true, data: quiz });
});

// @desc    Schedule a quiz to go live at a future date/time.
// @route   PUT /api/trainer/me/quizzes/:quizId/schedule
// @access  Private (TRAINER)
const scheduleQuiz = asyncHandler(async (req, res) => {
  const quiz = req.quiz;
  const { scheduledAt } = req.body;
  const when = new Date(scheduledAt);

  if (!scheduledAt || Number.isNaN(when.getTime())) {
    res.status(400);
    throw new Error('A valid scheduled date/time is required');
  }
  if (when <= new Date()) {
    res.status(400);
    throw new Error('Scheduled time must be in the future');
  }
  if (!quiz.questions.length) {
    res.status(400);
    throw new Error('Add at least one question before scheduling');
  }

  quiz.status = 'scheduled';
  quiz.scheduledAt = when;
  quiz.publishedAt = undefined;
  await quiz.save();
  res.json({ success: true, data: quiz });
});

// @desc    Move a quiz back to draft (unpublish/unschedule).
// @route   PUT /api/trainer/me/quizzes/:quizId/unpublish
// @access  Private (TRAINER)
const unpublishQuiz = asyncHandler(async (req, res) => {
  const quiz = req.quiz;
  quiz.status = 'draft';
  quiz.scheduledAt = undefined;
  quiz.publishedAt = undefined;
  await quiz.save();
  res.json({ success: true, data: quiz });
});

// @desc    Add a question to a quiz.
// @route   POST /api/trainer/me/quizzes/:quizId/questions
// @access  Private (TRAINER)
const addQuestion = asyncHandler(async (req, res) => {
  const quiz = req.quiz;
  const { error, value } = normalizeQuestion(req.body);
  if (error) {
    res.status(400);
    throw new Error(error);
  }
  quiz.questions.push(value);
  recomputeTotalMarks(quiz);
  await quiz.save();
  res.status(201).json({ success: true, data: quiz });
});

// @desc    Update one question on a quiz.
// @route   PUT /api/trainer/me/quizzes/:quizId/questions/:questionId
// @access  Private (TRAINER)
const updateQuestion = asyncHandler(async (req, res) => {
  const quiz = req.quiz;
  const question = quiz.questions.id(req.params.questionId);
  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }

  const { error, value } = normalizeQuestion({
    text: req.body.text ?? question.text,
    type: req.body.type ?? question.type,
    options: req.body.options ?? question.options,
    correctOptions: req.body.correctOptions ?? question.correctOptions,
    points: req.body.points ?? question.points,
  });
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  question.set(value);
  recomputeTotalMarks(quiz);
  await quiz.save();
  res.json({ success: true, data: quiz });
});

// @desc    Delete one question from a quiz.
// @route   DELETE /api/trainer/me/quizzes/:quizId/questions/:questionId
// @access  Private (TRAINER)
const deleteQuestion = asyncHandler(async (req, res) => {
  const quiz = req.quiz;
  const question = quiz.questions.id(req.params.questionId);
  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }
  question.deleteOne();
  recomputeTotalMarks(quiz);
  await quiz.save();
  res.json({ success: true, data: quiz });
});

// @desc    Student-wise quiz activity for this trainer's own quiz — every
//          student *enrolled in the quiz's batch* (via Enrollment, same
//          roster source getCourseStudents in trainerPortal.controller.js
//          already uses — never a direct Course-on-Student lookup), left-
//          joined with their own QuizAttempts for this quiz so a student who
//          hasn't attempted at all still appears (with an empty attempts
//          list) rather than being silently omitted. Ownership of the quiz
//          itself is already guaranteed by requireOwnQuiz (route
//          middleware) before this ever runs, so a trainer can only ever
//          reach their own quiz here, and — because the roster is derived
//          from that quiz's own batch — only ever their own students'
//          progress, never another trainer's.
// @route   GET /api/trainer/me/quizzes/:quizId/progress
// @access  Private (TRAINER)
const getQuizProgress = asyncHandler(async (req, res) => {
  const quiz = await syncSchedule(req.quiz);
  await quiz.populate('course', 'name');
  await quiz.populate('batch', 'batchCode');

  const enrollments = await Enrollment.find({ batch: quiz.batch._id, status: 'enrolled' })
    .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
    .sort({ rollNumber: 1 });

  const attempts = await QuizAttempt.find({
    quiz: quiz._id,
    student: { $in: enrollments.map((e) => e.student?._id).filter(Boolean) },
  }).sort({ attemptNumber: 1 });

  // Reconcile any attempt whose own deadline has quietly passed since it was
  // last read — same lazy-close-on-read pattern getQuizzes/getQuizInfo use
  // on the student side, so a trainer never sees a stale "in-progress" for
  // a session that's actually long over.
  await Promise.all(attempts.map((a) => closeExpiredAttempt(quiz, a)));

  const attemptsByStudent = new Map();
  attempts.forEach((a) => {
    const key = String(a.student);
    if (!attemptsByStudent.has(key)) attemptsByStudent.set(key, []);
    attemptsByStudent.get(key).push(a);
  });

  const totalQuestions = quiz.questions.length;
  const students = enrollments
    .filter((e) => e.student)
    .map((e) => {
      const studentAttempts = attemptsByStudent.get(String(e.student._id)) || [];
      const attemptsUsed = studentAttempts.length;
      const latest = studentAttempts[studentAttempts.length - 1] || null;
      const overallStatus = !latest ? 'not-started' : latest.status === 'in-progress' ? 'in-progress' : 'completed';

      return {
        studentId: e.student._id,
        name: e.student.user?.name,
        email: e.student.user?.email,
        // Same field the Trainer Portal's own Students Tab already reads
        // this from (Student.profilePicture, not User.avatar — see
        // getCourseStudents's comment in trainerPortal.controller.js).
        profilePicture: e.student.profilePicture,
        rollNumber: e.rollNumber,
        attemptsUsed,
        attemptsRemaining: Math.max(0, MAX_QUIZ_ATTEMPTS - attemptsUsed),
        overallStatus,
        attempts: studentAttempts.map((a) => {
          const answeredCount = a.answers.filter((ans) => ans.selectedOptions?.length).length;
          return {
            attemptId: a._id,
            attemptNumber: a.attemptNumber,
            status: a.status,
            startedAt: a.startedAt,
            submittedAt: a.submittedAt,
            deadline: a.deadline,
            late: a.late,
            answeredCount,
            totalQuestions,
            progressPercent: totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0,
            score: a.status === 'in-progress' ? null : a.score,
            totalMarks: a.totalMarks || quiz.totalMarks,
            percentage: a.status === 'in-progress' ? null : a.percentage,
          };
        }),
      };
    });

  res.json({
    success: true,
    data: {
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        courseName: quiz.course?.name,
        batchCode: quiz.batch?.batchCode,
        totalQuestions,
        totalMarks: quiz.totalMarks,
        maxAttempts: MAX_QUIZ_ATTEMPTS,
        availability: getQuizAvailability(quiz),
        startAt: quiz.startAt,
        endAt: quiz.endAt,
      },
      students,
    },
  });
});

module.exports = {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  scheduleQuiz,
  unpublishQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getQuizProgress,
  // Exported so studentPortal.controller.js can lazily flip an overdue
  // 'scheduled' quiz to 'published' the same way the Trainer Portal already
  // does, instead of a second implementation that could drift from this
  // one. Purely additive — every existing caller of this module is
  // unaffected.
  syncSchedule,
};
