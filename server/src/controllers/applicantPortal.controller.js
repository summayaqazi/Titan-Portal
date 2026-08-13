const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const Application = require('../models/Application');

// Self-service endpoints for the logged-in Applicant's own portal —
// submission only in this phase (Phase 3). Mirrors studentPortal.
// controller.js's own shape/conventions: every read/write is scoped to
// req.applicant (resolved server-side by attachOwnApplicant from req.user,
// never from anything client-supplied), so an applicant can never reach
// another applicant's data through this file.

// Multipart/FormData sends array-ish fields (skills[], languages[], links[])
// either as a single string or an array depending on how many values were
// sent — same quirk trainerAssignment.controller.js's own toArray already
// handles for this codebase's other multipart forms.
const toArray = (value) => {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

// @desc    Submit an application to a job, as the logged-in Applicant.
//          Creates the Application record only — never a Student, never a
//          second Applicant for this person. status is always 'pending';
//          nothing here can be set to anything else by the client.
// @route   POST /api/applicant/me/applications
// @access  Private (APPLICANT)
const submitApplication = asyncHandler(async (req, res) => {
  const applicant = req.applicant;

  // Only these fields are ever read from the request — status, history,
  // applicant id, and any other administrative field are never accepted
  // from the client, no matter what the request body contains.
  const { jobId, phone, qualification, experience, subjectCommand } = req.body;
  const skills = toArray(req.body.skills);
  const languages = toArray(req.body.languages);
  const links = toArray(req.body.links);

  if (!jobId) {
    res.status(400);
    throw new Error('A job must be selected');
  }
  if (!qualification || !String(qualification).trim()) {
    res.status(400);
    throw new Error('Qualification is required');
  }
  if (!experience || !String(experience).trim()) {
    res.status(400);
    throw new Error('Experience is required');
  }

  const job = await Job.findById(jobId);
  if (!job) {
    res.status(400);
    throw new Error('Selected job does not exist');
  }
  if (job.status !== 'open') {
    res.status(400);
    throw new Error('This job is not open for applications');
  }
  const now = new Date();
  if (job.openingDate && now < new Date(job.openingDate)) {
    res.status(400);
    throw new Error('Applications for this job have not opened yet');
  }
  if (job.closingDate && now > new Date(job.closingDate)) {
    res.status(400);
    throw new Error('Applications for this job have closed');
  }

  if (job.resumeRequired && !req.file) {
    res.status(400);
    throw new Error('A resume/CV is required to apply for this job');
  }

  // Friendly pre-check; the {applicant, job} unique index on Application is
  // still the final guard under concurrent requests (same pattern the
  // public course-enrollment flow already uses for {student, course, batch}).
  const existingApplication = await Application.findOne({ applicant: applicant._id, job: job._id });
  if (existingApplication) {
    res.status(409);
    throw new Error('You have already applied to this job.');
  }

  // Keeps the applicant's contact number current on their own account —
  // an existing User field, not a schema change, and only ever writes to
  // the authenticated caller's own User document.
  if (phone && phone !== req.user.phone) {
    req.user.phone = phone;
    await req.user.save();
  }

  let application;
  try {
    application = await Application.create({
      applicant: applicant._id,
      job: job._id,
      qualification,
      experience,
      skills,
      subjectCommand,
      languages,
      links,
      // Private storage only (server/src/private-uploads/resumes/, never
      // mounted by express.static) — never a /uploads/... public path.
      resumePath: req.file ? `private-uploads/resumes/${req.file.filename}` : undefined,
      status: 'pending',
      history: [{ status: 'pending', note: 'Application submitted', changedBy: req.user._id }],
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('You have already applied to this job.');
    }
    throw err;
  }

  // Never returns resumePath (a private filesystem-adjacent reference) or
  // any other applicant's data — only what the Application Success page
  // needs to display.
  res.status(201).json({
    success: true,
    data: {
      applicationId: application._id,
      status: application.status,
      appliedDate: application.appliedDate,
      job: { _id: job._id, title: job.title },
    },
  });
});

module.exports = { submitApplication };
