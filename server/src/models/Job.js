const mongoose = require('mongoose');
const { JOB_TYPES, JOB_STATUSES } = require('../utils/constants');

// Job Portal — a job posting managed by Super Admin (Campus Admin gets
// view-only access, enforced via the 'jobs' permission module, not here —
// see job.controller.js). Not fully standalone from Campus/Trainer/Batch
// etc — `campus` (below) is the one deliberate link, added so Campus
// Admin's read-only job list can be scoped to whichever campus is
// currently selected on the Admin Portal's Campus Selector; still no
// relationship to Course/Batch/Trainer, a job opening isn't an academic
// offering.
const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    // 'Employment Type'/'Full Time'/'Part Time'/'Contract' from the spec are
    // the same concept as jobType — one field, not two.
    jobType: { type: String, enum: JOB_TYPES, required: true },
    // The city/location the position is based in — free text (not a ref to
    // the Campus/City models) since a job posting isn't tied to a campus
    // and can be in a city with no campus at all; Super Admin/Admin can
    // type any city. Deliberately optional: older jobs created before this
    // field existed have no value here and must keep working everywhere
    // (list/details/application pages all conditionally render it).
    city: { type: String, trim: true },
    // The specific TITAN campus this opening belongs to, if any — distinct
    // from the free-text `city` above (a job can be in a city with no
    // campus, or general/remote with no campus at all). Optional: an
    // unassigned job is still shown to a Campus Admin whose currently
    // selected campus's city matches `city` above (matched as free text —
    // see job.controller.js's getAdminJobScope), but never to one viewing a
    // different city, and never when both `campus` and `city` are unset.
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus' },
    // Server-relative path (e.g. "/uploads/xyz.png") to the job posting's
    // banner image — same public `upload` multer instance + storage
    // directory as User.avatar (server/src/middleware/upload.middleware.js),
    // never the private resume storage. Always optional — a job can be
    // published (status='open') with or without one; only ever shown on
    // the public Job Details page, deliberately never in a jobs listing
    // (admin table or public careers grid), which shows no image at all.
    image: { type: String },
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
