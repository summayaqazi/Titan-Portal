const mongoose = require('mongoose');

// A student's submission against one Assignment. Student Portal submission
// creation is a later phase (out of scope here); this model exists now so
// the Trainer-facing review UI (statistics/list/approve/reject/feedback)
// has real, persisted data to work with as soon as students can submit.
const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    description: { type: String },
    files: [{ type: String }],
    links: [{ type: String, trim: true }],
    submittedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    feedback: { type: String, trim: true },
    feedbackBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    feedbackAt: { type: Date },
  },
  { timestamps: true }
);

// One submission per student per assignment — a resubmission overwrites
// (upserted), matching how Attendance treats one record per
// enrollment/date rather than accumulating a history of retries.
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
