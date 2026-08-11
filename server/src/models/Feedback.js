const mongoose = require('mongoose');

// General product feedback (bug/idea/other) from a logged-in account —
// distinct from Submission.feedback (a Trainer's per-assignment grading
// note to one student, already covered by Assignment/Submission). No
// dedicated Feedback infrastructure existed anywhere in this codebase
// before this model (verified by inspection, not assumed).
//
// Keyed on `user` (not `student`) — feedback belongs to whoever is logged
// in, not to any one role's profile record, so the same collection could
// back a feedback entry point in another portal later without a schema
// change. Only the Student Portal writes to it today.
const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['bug', 'idea', 'other'], required: true },
    message: { type: String, required: true, trim: true },
    images: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
