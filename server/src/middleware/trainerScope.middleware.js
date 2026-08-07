const asyncHandler = require('express-async-handler');
const Trainer = require('../models/Trainer');
const Batch = require('../models/Batch');
const Assignment = require('../models/Assignment');
const Quiz = require('../models/Quiz');

// Resolves the logged-in TRAINER's own Trainer document once per request
// and stashes it on req.trainer, for every Trainer-portal route to use —
// never derived from anything client-supplied.
const attachOwnTrainer = asyncHandler(async (req, res, next) => {
  const trainer = await Trainer.findOne({ user: req.user._id });
  if (!trainer) {
    res.status(404);
    throw new Error('No trainer profile found for this account');
  }
  req.trainer = trainer;
  next();
});

// Verifies the batch referenced by the request (route param, query, or
// body — whichever this endpoint uses) is actually assigned to the caller's
// own Trainer before letting a shared (Admin-facing) controller function
// run. A trainer can never reach another trainer's batch/students/
// attendance through these routes, regardless of what id the client sends.
const requireOwnBatch = asyncHandler(async (req, res, next) => {
  const batchId = req.params.batchId || req.query.batch || req.body.batch;
  if (!batchId) {
    res.status(400);
    throw new Error('Batch is required');
  }
  const batch = await Batch.findOne({ _id: batchId, trainer: req.trainer._id });
  if (!batch) {
    res.status(403);
    throw new Error('Forbidden: this batch is not assigned to you');
  }
  req.batch = batch;
  next();
});

// Same idea as requireOwnBatch, for routes addressed by an assignment id
// instead (edit/delete an assignment, view/review its submissions) — an
// assignment belonging to another trainer must 403, never leak through.
const requireOwnAssignment = asyncHandler(async (req, res, next) => {
  const assignmentId = req.params.assignmentId;
  const assignment = await Assignment.findOne({ _id: assignmentId, trainer: req.trainer._id });
  if (!assignment) {
    res.status(403);
    throw new Error('Forbidden: this assignment does not belong to you');
  }
  req.assignment = assignment;
  next();
});

// Same idea again, for routes addressed by a quiz id (edit/delete/publish/
// schedule a quiz, manage its questions) — a quiz belonging to another
// trainer must 403, never leak through.
const requireOwnQuiz = asyncHandler(async (req, res, next) => {
  const quizId = req.params.quizId;
  const quiz = await Quiz.findOne({ _id: quizId, trainer: req.trainer._id });
  if (!quiz) {
    res.status(403);
    throw new Error('Forbidden: this quiz does not belong to you');
  }
  req.quiz = quiz;
  next();
});

module.exports = { attachOwnTrainer, requireOwnBatch, requireOwnAssignment, requireOwnQuiz };
