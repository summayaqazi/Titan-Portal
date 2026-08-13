const asyncHandler = require('express-async-handler');
const path = require('path');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { APPLICATION_STATUSES } = require('../utils/constants');

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

// Job fields shown back to the owning applicant — same whitelist discipline
// as publicJob.controller.js's own serializer (never createdBy/updatedBy,
// an internal/administrative detail the applicant doesn't need). `job` can
// be null if the Job was deleted after the application was submitted —
// callers must handle that, never assume it's present.
const serializeJobForApplicant = (job) => {
  if (!job) return null;
  return {
    _id: job._id,
    title: job.title,
    jobType: job.jobType,
    experience: job.experience,
    qualification: job.qualification,
    about: job.about,
    subjectCommand: job.subjectCommand,
    skills: job.skills,
    expectedSalary: job.expectedSalary,
    languages: job.languages,
    links: job.links,
    description: job.description,
    requirements: job.requirements,
    openingDate: job.openingDate,
    closingDate: job.closingDate,
    status: job.status,
  };
};

const serializeApplicationSummary = (application) => ({
  _id: application._id,
  status: application.status,
  appliedDate: application.appliedDate,
  job: serializeJobForApplicant(application.job),
});

// Full detail view — includes what the applicant themselves submitted and
// the status history, but never resumePath (a private-uploads/ filesystem
// reference) and never history[].changedBy (an internal User id) — only
// `resumeFilename` (the stored file's basename only, no directory) is
// exposed, matching the "no private path/directory" requirement; the
// client recovers a clean display name from it via the same prettyFileName()
// utility already used for every other upload's display name elsewhere in
// the app (client/src/utils/downloadFile.js) — not a second implementation.
const serializeApplicationDetail = (application) => ({
  _id: application._id,
  status: application.status,
  appliedDate: application.appliedDate,
  qualification: application.qualification,
  experience: application.experience,
  skills: application.skills,
  subjectCommand: application.subjectCommand,
  languages: application.languages,
  links: application.links,
  hasResume: Boolean(application.resumePath),
  resumeFilename: application.resumePath ? path.basename(application.resumePath) : null,
  history: (application.history || []).map((h) => ({ status: h.status, note: h.note, changedAt: h.changedAt })),
  job: serializeJobForApplicant(application.job),
});

// @desc    Summary counts + a few recent applications for the logged-in
//          Applicant's own Dashboard. Every number is a live query scoped
//          to req.applicant — never another applicant's data, never
//          hardcoded.
// @route   GET /api/applicant/me/dashboard
// @access  Private (APPLICANT)
const getDashboard = asyncHandler(async (req, res) => {
  const applications = await Application.find({ applicant: req.applicant._id })
    .populate('job', 'title jobType status closingDate')
    .sort({ appliedDate: -1 });

  const counts = { total: applications.length, pending: 0, under_review: 0, shortlisted: 0, approved: 0, rejected: 0 };
  applications.forEach((a) => {
    if (counts[a.status] !== undefined) counts[a.status] += 1;
  });

  res.json({
    success: true,
    data: {
      counts,
      recent: applications.slice(0, 5).map(serializeApplicationSummary),
    },
  });
});

// @desc    List every application belonging to the logged-in Applicant.
//          Paginated (parseListQuery/paginatedResponse — same convention as
//          every other list endpoint in the app) with an optional status
//          filter. No text search — an applicant's own application count is
//          small enough that a search box would be overbuilding it.
// @route   GET /api/applicant/me/applications
// @access  Private (APPLICANT)
const getMyApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseListQuery(req);

  const filter = { applicant: req.applicant._id };
  if (req.query.status && APPLICATION_STATUSES.includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate('job', 'title jobType status closingDate')
      .sort({ appliedDate: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items: applications.map(serializeApplicationSummary), total, page, limit }));
});

// @desc    A single application's full detail — ownership enforced by the
//          query itself ({_id, applicant: req.applicant._id}), never by a
//          separate "is this mine?" check after the fact. An id that
//          exists but belongs to a different applicant returns the exact
//          same 404 as an id that doesn't exist at all — never reveals
//          whether another applicant's application exists.
// @route   GET /api/applicant/me/applications/:id
// @access  Private (APPLICANT)
const getMyApplication = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, applicant: req.applicant._id }).populate('job');
  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }

  res.json({ success: true, data: serializeApplicationDetail(application) });
});

// @desc    Download the resume/CV attached to one of the logged-in
//          Applicant's OWN applications. Not a "/resume/:filename"-style
//          unrestricted route — ownership is enforced the same way as
//          getMyApplication (query-scoped to req.applicant._id), so this
//          can never serve another applicant's file no matter what id is
//          requested. Streams from the private, non-statically-served
//          uploads directory (see upload.middleware.js's uploadResume).
// @route   GET /api/applicant/me/applications/:id/resume
// @access  Private (APPLICANT)
const downloadMyResume = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, applicant: req.applicant._id });
  if (!application || !application.resumePath) {
    res.status(404);
    throw new Error('Resume not found');
  }

  const absolutePath = path.join(__dirname, '..', application.resumePath);
  res.download(absolutePath, path.basename(application.resumePath));
});

module.exports = { submitApplication, getDashboard, getMyApplications, getMyApplication, downloadMyResume };
