const mongoose = require('mongoose');
const { JOB_TYPES, JOB_STATUSES } = require('../utils/constants');

// Job Portal — a job posting managed by Super Admin (Campus Admin gets
// view-only access, enforced via the 'jobs' permission module, not here).
// Deliberately flat and standalone: no relationship to Course/Batch/Campus/
// Trainer — a job opening is not an academic offering, so it doesn't reuse
// or extend any of those locked models.
const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    // 'Employment Type'/'Full Time'/'Part Time'/'Contract' from the spec are
    // the same concept as jobType — one field, not two.
    jobType: { type: String, enum: JOB_TYPES, required: true },
    experience: { type: String, trim: true },
    qualification: { type: String, trim: true },
    about: { type: String, trim: true },
    subjectCommand: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    // Kept as free text (e.g. "PKR 80,000 - 120,000") rather than a
    // structured min/max — simplest fit for what a job posting form needs,
    // no invented structure the spec didn't ask for.
    expectedSalary: { type: String, trim: true },
    languages: [{ type: String, trim: true }],
    links: [{ type: String, trim: true }],
    description: { type: String, trim: true },
    requirements: [{ type: String, trim: true }],
    openingDate: { type: Date },
    closingDate: { type: Date },
    // draft -> open -> closed. "Publish"/"Open" collapse to the single
    // 'open' value (see JOB_STATUSES in utils/constants.js).
    status: { type: String, enum: JOB_STATUSES, default: 'draft', index: true },
    // Whether a resume/CV is required to apply to this specific job —
    // configurable per job rather than a single hardcoded app-wide rule.
    resumeRequired: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);
