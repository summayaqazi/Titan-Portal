const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { ROLES, JOB_TYPES, JOB_STATUSES } = require('../utils/constants');

// Super Admin + Admin (Campus Admin) job management. Ownership model:
// Super Admin manages every job; Admin can VIEW every job but only
// create/edit/delete/publish the ones they personally created
// (Job.createdBy, already on the model since Phase 1) — enforced here in
// the controller, not just by the 'jobs' permission grid (that only gates
// whether the action exists at all for the role, same division of
// responsibility used throughout this codebase). Never trusts a
// client-supplied role/ownership claim.

const POPULATE = [
  { path: 'createdBy', select: 'name' },
  { path: 'updatedBy', select: 'name' },
];

// True once for Super Admin (always allowed) or when the job was created
// by this exact Admin. Never derived from anything the client sends.
// job.createdBy may be a raw ObjectId (updateJob/deleteJob fetch it
// unpopulated, since only the id comparison matters there) or an already-
// populated {_id, name} object (getJobs/getJob populate it for display) —
// handled either way so the ownership check is correct regardless of which
// caller passes it in.
const canManageJob = (req, job) => {
  if (req.user.role === ROLES.SUPER_ADMIN) return true;
  const creatorId = job.createdBy?._id || job.createdBy;
  return creatorId?.toString() === req.user._id.toString();
};

const validateDates = (openingDate, closingDate) => {
  if (openingDate && closingDate && new Date(closingDate) <= new Date(openingDate)) {
    return 'Closing date must be after opening date';
  }
  return null;
};

// @desc    List jobs — Super Admin and Admin both see every job (Admin's
//          restriction is on which ones they can MODIFY, not view).
// @route   GET /api/jobs
// @access  Private (SUPER_ADMIN, ADMIN — 'jobs' view permission)
const getJobs = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (req.query.status && JOB_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.jobType && JOB_TYPES.includes(req.query.jobType)) filter.jobType = req.query.jobType;

  const [items, total] = await Promise.all([
    Job.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);

  // `canManage` rides along per row so the UI can enable/disable
  // Edit/Publish/Close/Delete per job without a second round trip — purely
  // a display hint; the real enforcement is still server-side on each
  // mutating route below.
  const withCanManage = items.map((job) => ({ ...job.toObject(), canManage: canManageJob(req, job) }));

  res.json(paginatedResponse({ items: withCanManage, total, page, limit }));
});

const getJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id).populate(POPULATE);
  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }
  res.json({ success: true, data: { ...job.toObject(), canManage: canManageJob(req, job) } });
});

const createJob = asyncHandler(async (req, res) => {
  const {
    title,
    jobType,
    experience,
    qualification,
    about,
    subjectCommand,
    skills,
    expectedSalary,
    languages,
    links,
    description,
    requirements,
    openingDate,
    closingDate,
    status,
    resumeRequired,
  } = req.body;

  if (!title || !String(title).trim()) {
    res.status(400);
    throw new Error('Job title is required');
  }
  if (!jobType || !JOB_TYPES.includes(jobType)) {
    res.status(400);
    throw new Error('A valid job type is required');
  }
  if (status !== undefined && !JOB_STATUSES.includes(status)) {
    res.status(400);
    throw new Error('Invalid job status');
  }
  const dateError = validateDates(openingDate, closingDate);
  if (dateError) {
    res.status(400);
    throw new Error(dateError);
  }

  // createdBy/updatedBy always the authenticated caller — never accepted
  // from the request body, so a job can never be created "as" someone else.
  const job = await Job.create({
    title,
    jobType,
    experience,
    qualification,
    about,
    subjectCommand,
    skills: skills || [],
    expectedSalary,
    languages: languages || [],
    links: links || [],
    description,
    requirements: requirements || [],
    openingDate: openingDate || undefined,
    closingDate: closingDate || undefined,
    // Creating a job never auto-publishes it — defaults to 'draft' unless
    // explicitly set, same "don't auto-approve" caution used for
    // Enrollment/Application status elsewhere in this app.
    status: status || 'draft',
    resumeRequired: resumeRequired === undefined ? true : Boolean(resumeRequired),
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: await job.populate(POPULATE) });
});

const updateJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }
  if (!canManageJob(req, job)) {
    res.status(403);
    throw new Error('Forbidden: you can only edit jobs you created');
  }

  const {
    title,
    jobType,
    experience,
    qualification,
    about,
    subjectCommand,
    skills,
    expectedSalary,
    languages,
    links,
    description,
    requirements,
    openingDate,
    closingDate,
    status,
    resumeRequired,
  } = req.body;

  if (jobType !== undefined && !JOB_TYPES.includes(jobType)) {
    res.status(400);
    throw new Error('Invalid job type');
  }
  if (status !== undefined && !JOB_STATUSES.includes(status)) {
    res.status(400);
    throw new Error('Invalid job status');
  }
  const dateError = validateDates(
    openingDate !== undefined ? openingDate : job.openingDate,
    closingDate !== undefined ? closingDate : job.closingDate
  );
  if (dateError) {
    res.status(400);
    throw new Error(dateError);
  }

  if (title !== undefined) job.title = title;
  if (jobType !== undefined) job.jobType = jobType;
  if (experience !== undefined) job.experience = experience;
  if (qualification !== undefined) job.qualification = qualification;
  if (about !== undefined) job.about = about;
  if (subjectCommand !== undefined) job.subjectCommand = subjectCommand;
  if (skills !== undefined) job.skills = skills;
  if (expectedSalary !== undefined) job.expectedSalary = expectedSalary;
  if (languages !== undefined) job.languages = languages;
  if (links !== undefined) job.links = links;
  if (description !== undefined) job.description = description;
  if (requirements !== undefined) job.requirements = requirements;
  if (openingDate !== undefined) job.openingDate = openingDate || undefined;
  if (closingDate !== undefined) job.closingDate = closingDate || undefined;
  if (status !== undefined) job.status = status;
  if (resumeRequired !== undefined) job.resumeRequired = Boolean(resumeRequired);
  job.updatedBy = req.user._id;

  await job.save();
  res.json({ success: true, data: await job.populate(POPULATE) });
});

const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }
  if (!canManageJob(req, job)) {
    res.status(403);
    throw new Error('Forbidden: you can only delete jobs you created');
  }

  const applicationCount = await Application.countDocuments({ job: job._id });
  if (applicationCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a job that already has applications — close it instead');
  }

  await job.deleteOne();
  res.json({ success: true, message: 'Job deleted' });
});

module.exports = { getJobs, getJob, createJob, updateJob, deleteJob };
