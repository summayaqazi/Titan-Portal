const mongoose = require('mongoose');

// One question, embedded in its Quiz (no separate collection — mirrors how
// Assignment keeps its reference lists/files inline rather than as child
// documents). `options` always holds the full answer list (auto-filled with
// ['True', 'False'] for the true-false type); `correctOptions` is a list of
// indices into it, so both single- and multi-correct questions share one
// shape instead of needing separate fields.
const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    type: { type: String, enum: ['single', 'multiple', 'true-false'], default: 'single' },
    options: [{ type: String, trim: true }],
    correctOptions: [{ type: Number, min: 0 }],
    points: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    durationMinutes: { type: Number, default: 30, min: 1 },
    questions: [questionSchema],
    // Denormalized sum of questions.points, recomputed by the controller on
    // every question add/update/delete — read-heavy (list/detail views),
    // written rarely, worth caching rather than summing per request.
    totalMarks: { type: Number, default: 0 },

    // draft -> scheduled -> published. 'scheduled' auto-flips to
    // 'published' once scheduledAt has passed (checked lazily on read, no
    // cron needed — see trainerQuiz.controller.js#syncSchedule).
    status: { type: String, enum: ['draft', 'scheduled', 'published'], default: 'draft' },
    scheduledAt: { type: Date },
    publishedAt: { type: Date },

    // Availability window — independent of the draft/scheduled/published
    // status above (that controls whether a quiz is live at all;
    // startAt/endAt control the date/time range a *published* quiz can
    // actually be attempted within). Both optional so every quiz that
    // existed before this field was added keeps its old "no time limit
    // once published" behavior — only quizzes a trainer explicitly sets
    // these on get the new start/end enforcement. Server/DB time (`Date.now`
    // via `new Date()`) is always what's compared against, never a
    // client-supplied timestamp — see startQuizAttempt/getQuizAvailability
    // in studentPortal.controller.js.
    startAt: { type: Date },
    endAt: { type: Date },

    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
