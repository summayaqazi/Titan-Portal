const asyncHandler = require('express-async-handler');
const path = require('path');
const Application = require('../models/Application');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { APPLICATION_STATUSES } = require('../utils/constants');

// Super Admin Application Management (Job Portal Phase 5). Admin/Campus
// Admin has no access here at all — the 'applications' permission grid
// grants Admin nothing (see seed.js), same as Phase 1 left it; this file
// only exists for Super Admin in practice, enforced the same
// authorize+checkPermission layering as every other admin-facing route
// file in this app (never a client-trusted role check).
//
// Applicant ownership from Phase 4 (attachOwnApplicant, applicantPortal.*)
// is completely untouched — this is a parallel, staff-facing view over the
// exact same Application collection, not a second implementation of it.

const POPULATE = [
  { path: 'applicant', populate: { path: 'user', select: 'name email phone' } },
  { path: 'job', select: 'title jobType status openingDate closingDate' },
];

const serializeApplication = (application) => ({
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
  applicant: application.applicant
    ? {
        _id: application.applicant._id,
        name: application.applicant.user?.name,
        email: application.applicant.user?.email,
        phone: application.applicant.user?.phone,
      }
    : null,
  job: application.job
    ? {
        _id: application.job._id,
        title: application.job.title,
        jobType: application.job.jobType,
        status: application.job.status,
        closingDate: application.job.closingDate,
      }
    : null,
});

// @desc    List every application in the system. Paginated, filterable by
//          status and by job.
// @route   GET /api/applications
// @access  Private (SUPER_ADMIN — 'applications' view permission)
const getApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseListQuery(req);

  const filter = {};
  if (req.query.status && APPLICATION_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.job) filter.job = req.query.job;

  const [applications, total] = await Promise.all([
    Application.find(filter).populate(POPULATE).sort({ appliedDate: -1 }).skip(skip).limit(limit),
    Application.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items: applications.map(serializeApplication), total, page, limit }));
});

// @desc    Single application's full detail for review.
// @route   GET /api/applications/:id
// @access  Private (SUPER_ADMIN — 'applications' view permission)
const getApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id).populate(POPULATE);
  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }
  res.json({ success: true, data: serializeApplication(application) });
});

// @desc    Change an application's status (Shortlist/Approve/Reject/Under
//          Review are all just different status values through this one
//          action — same convention Enrollment's updateEnrollment already
//          uses, not a second status system). Every real status change
//          appends a history entry; setting the same status again is a
//          no-op (no duplicate history entry).
// @route   PUT /api/applications/:id
// @access  Private (SUPER_ADMIN — 'applications' update permission)
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }

  const { status, note } = req.body;
  if (!status || !APPLICATION_STATUSES.includes(status)) {
    res.status(400);
    throw new Error('A valid status is required');
  }

  if (status !== application.status) {
    application.history.push({ status, note, changedBy: req.user._id });
    application.status = status;
    await application.save();
  }

  const populated = await application.populate(POPULATE);
  res.json({ success: true, data: serializeApplication(populated) });
});

// @desc    Download an applicant's resume/CV for review. Not a public or
//          applicant-scoped route — gated on 'applications' export
//          permission (Super Admin only, per current requirements).
// @route   GET /api/applications/:id/resume
// @access  Private (SUPER_ADMIN — 'applications' export permission)
const downloadApplicationResume = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application || !application.resumePath) {
    res.status(404);
    throw new Error('Resume not found');
  }

  const absolutePath = path.join(__dirname, '..', application.resumePath);
  res.download(absolutePath, path.basename(application.resumePath));
});

module.exports = { getApplications, getApplication, updateApplicationStatus, downloadApplicationResume };
