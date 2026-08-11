const mongoose = require('mongoose');

// One selected answer for one question on the parent Quiz. `question` is
// the _id of a subdocument inside Quiz.questions — not a separate
// collection reference — since questions only ever exist embedded in their
// Quiz (see Quiz.js). `selectedOptions` mirrors Quiz.questions.correctOptions'
// shape (a list of option indices) so both single- and multi-correct
// questions share one answer shape, same reasoning Quiz.js documents for
// its own options/correctOptions fields.
const answerSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedOptions: [{ type: Number, min: 0 }],
  },
  { _id: false }
);

// A single student's attempt at a Quiz. Deliberately its own collection
// rather than embedded on Quiz or Student — an attempt belongs to neither
// (many students attempt one Quiz; one Student may attempt many Quizzes,
// possibly more than once each), the same many-to-many reasoning that
// already justifies Submission being its own collection rather than living
// on Assignment or Student.
//
// Unlike Submission (one upserted document per student+assignment,
// resubmission overwrites), each Quiz attempt is a distinct, immutable-once-
// graded document — attemptNumber increments per (student, quiz) pair so a
// full history of past tries is preserved, never silently overwritten. The
// Quiz schema has no attempt-limit field anywhere, so no cap is enforced
// here either (see studentPortal.controller.js's startQuizAttempt) — only
// one attempt may be `in-progress` at a time per (student, quiz), which is
// an anti-duplicate-submission safeguard, not an attempts cap.
//
// `totalMarks`/`totalQuestions` are snapshotted onto the attempt at grading
// time (not read live off Quiz) so a later trainer edit to the quiz's
// questions can never retroactively change what an already-graded attempt
// is shown to be out of.
const quizAttemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },

    answers: [answerSchema],

    // Populated only once grading happens (on submit, or on server-side
    // auto-close of an expired never-submitted attempt) — all zero/blank
    // while status is 'in-progress'.
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },

    status: { type: String, enum: ['in-progress', 'passed', 'failed'], default: 'in-progress', index: true },

    startedAt: { type: Date, required: true, default: Date.now },
    // Snapshotted from quiz.durationMinutes at start time (startedAt +
    // duration) — the single server-side source of truth for "has this
    // attempt's time run out", so a later trainer edit to the quiz's
    // duration can't retroactively shorten or extend a running attempt,
    // and the browser's own clock is never trusted for enforcement.
    deadline: { type: Date },
    submittedAt: { type: Date },
    // True if this attempt was graded past its deadline — whether because
    // the browser's own auto-submit-on-expiry fired, or because the
    // student simply never came back and a later request found it expired
    // and closed it with whatever (possibly zero) answers were on file.
    // Informational only; grading itself is identical either way.
    late: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One attempt document per (student, quiz, attemptNumber) — enforces that
// attemptNumber is actually a stable, collision-free sequence per student
// per quiz, the same guarantee Attendance's {enrollment,date} unique index
// gives that model.
quizAttemptSchema.index({ student: 1, quiz: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
