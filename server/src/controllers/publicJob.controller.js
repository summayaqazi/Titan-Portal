const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { JOB_TYPES } = require('../utils/constants');

// Public-facing (unauthenticated) job browsing endpoints — Phase 2 of the
// Job Portal. Deliberately isolated in their own controller/route file
// rather than appended to the existing public.controller.js/public.routes.js
// (the already-shipped, already-reviewed public course/registration flow)
// so this phase carries zero risk of regressing that locked flow: nothing
// in this file is imported by, or imports, those files.
//
// No application-submission logic lives here yet (Phase 3+) — this is
// browse-only: list open jobs, view one job's details.

const OPEN_STATUS = 'open';

// A job is only actually "available" when its status is 'open' AND the
// current moment falls inside its opening/closing window — status alone
// doesn't guarantee that (an admin may leave status 'open' before the
// opening date, or forget to flip it to 'closed' after the closing date).
const computeApplicationState = (job, now = new Date()) => {
  if (job.status !== OPEN_STATUS) return 'closed';
  if (job.openingDate && now < new Date(job.openingDate)) return 'upcoming';
  if (job.closingDate && now > new Date(job.closingDate)) return 'closed';
  return 'open';
};

// Only the fields a public visitor should ever see. createdBy/updatedBy
// (internal audit fields) are deliberately never included.
const serializeJobSummary = (job) => ({
  _id: job._id,
  title: job.title,
  jobType: job.jobType,
  experience: job.experience,
  qualification: job.qualification,
  expectedSalary: job.expectedSalary,
  skills: job.skills,
  about: job.about,
  openingDate: job.openingDate,
  closingDate: job.closingDate,
  status: job.status,
});

const serializeJobDetail = (job) => ({
  ...serializeJobSummary(job),
  subjectCommand: job.subjectCommand,
  languages: job.languages,
  links: job.links,
  description: job.description,
  requirements: job.requirements,
  resumeRequired: job.resumeRequired,
  // 'open' | 'upcoming' | 'closed' — drives the Apply Now / closed-state UI.
  applicationState: computeApplicationState(job),
});

// @desc    List jobs currently open for public application (status='open'
//          AND within its opening/closing window). Never hardcoded — always
//          a live, paginated MongoDB query. Draft and closed jobs never
//          appear here.
// @route   GET /api/public/jobs
// @access  Public
const getPublicJobs = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);
  const now = new Date();

  const filter = {
    status: OPEN_STATUS,
    $and: [
      { $or: [{ openingDate: null }, { openingDate: { $lte: now } }] },
      { $or: [{ closingDate: null }, { closingDate: { $gte: now } }] },
    ],
  };

  if (req.query.jobType && JOB_TYPES.includes(req.query.jobType)) {
    filter.jobType = req.query.jobType;
  }

  if (search) {
    filter.$and.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { qualification: { $regex: search, $options: 'i' } },
        { experience: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const [items, total] = await Promise.all([
    Job.find(filter).sort({ openingDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items: items.map(serializeJobSummary), total, page, limit }));
});

// @desc    Job details for the public Job Details page. Reachable for a
//          'closed' job too (so a shared/bookmarked link shows a proper
//          closed state instead of a bare error) — but NEVER for a 'draft'
//          job, which returns the same 404 as a nonexistent id so a draft's
//          existence is never revealed to an unauthenticated visitor.
// @route   GET /api/public/jobs/:id
// @access  Public
const getPublicJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job || job.status === 'draft') {
    res.status(404);
    throw new Error('Job not found');
  }

  res.json({ success: true, data: serializeJobDetail(job) });
});

module.exports = { getPublicJobs, getPublicJob };
