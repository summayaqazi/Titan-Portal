const mongoose = require('mongoose');

// A topic is the unit progress is actually tracked at — "completed" is the
// one field trainers update from the UI (Course Progress tab).
const topicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    topics: [topicSchema],
  },
  { timestamps: true }
);

// One document per COURSE (not per batch) — the curriculum is the course's,
// so every batch/trainer teaching that course shares and sees the same
// modules/topics automatically, instead of each batch starting from an
// empty "no modules yet" state. Completion is tracked on the same shared
// document (a topic is either done for the course or it isn't), matching
// how one real course has one real syllabus. `trainer` records who first
// created the document (audit only — every trainer teaching the course can
// edit it, verified via their own batch->course link, not this field).
// Overall/module/topic percentages are derived on read
// (trainerProgress.controller.js#withComputed), never stored, so they can't
// drift from the underlying completed flags.
const courseProgressSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, unique: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true },
    modules: [moduleSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('CourseProgress', courseProgressSchema);
