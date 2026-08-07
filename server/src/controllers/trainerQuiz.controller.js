const asyncHandler = require('express-async-handler');
const Quiz = require('../models/Quiz');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const QUESTION_TYPES = ['single', 'multiple', 'true-false'];

const recomputeTotalMarks = (quiz) => {
  quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.points || 0), 0);
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

  const quiz = await Quiz.create({
    title: title.trim(),
    description,
    durationMinutes: durationMinutes || 30,
    course: req.batch.course,
    batch: req.batch._id,
    trainer: req.trainer._id,
  });

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
};
