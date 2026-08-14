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
    // Server-relative path (e.g. "/uploads/xyz.png") to the applicant's own
    // photo, submitted together with the rest of the application form —
    // same public `upload` multer instance + storage directory as
    // User.avatar/Student.profilePicture (server/src/middleware/upload.
    // middleware.js), never the private resume storage. Mandatory for
    // every application (enforced in applicantPortal.controller.js's
    // submitApplication, not here — same "business rule in the
    // controller" discipline this app already uses for resumePath's own
    // conditional requirement below) — completely distinct from Job.image
    // (the job posting's own banner) and never reused as one.
    photoPath: { type: String },
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
    // How this application was submitted. Server-set only (see
    // submitApplication in applicantPortal.controller.js) — never read from
    // the client, same as status/history below. Currently always 'Online
    // Application' since the public Job Portal is the only submission
    // channel that exists; kept as its own field (not hardcoded into every
    // display site) so a future channel (e.g. referral, walk-in) can be
    // recorded without a schema change.
    applicationMethod: { type: String, trim: true, default: 'Online Application' },
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
