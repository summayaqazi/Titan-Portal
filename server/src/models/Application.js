const mongoose = require('mongoose');
const { APPLICATION_STATUSES } = require('../utils/constants');

// Same shape as Enrollment.js's own history sub-schema — one entry per
// status change, who made it, and an optional note.
const applicationHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    note: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Job Portal — the Applicant <-> Job relationship, mirroring how
// Enrollment is the Student <-> Course relationship: an Applicant never
// stores a single "selected job" field, this record is that relationship,
// and one Applicant can have many Applications (one per Job).
const applicationSchema = new mongoose.Schema(
  {
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    // Submitted at application time — specific to this application, not a
    // standing Applicant profile field (see Applicant.js's own comment).
    qualification: { type: String, trim: true },
    experience: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    subjectCommand: { type: String, trim: true },
    languages: [{ type: String, trim: true }],
    // Path of the uploaded resume/CV file (Multer-stored). Never served via
    // a public static link — always resolved through a permission-gated
    // download endpoint (added in a later phase).
    resumePath: { type: String },
    links: [{ type: String, trim: true }],
    status: { type: String, enum: APPLICATION_STATUSES, default: 'pending' },
    appliedDate: { type: Date, default: Date.now },
    history: [applicationHistorySchema],
  },
  { timestamps: true }
);

// Prevents duplicate applications to the same job by the same applicant —
// same mechanism as Enrollment's {student, course, batch} unique index.
applicationSchema.index({ applicant: 1, job: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
