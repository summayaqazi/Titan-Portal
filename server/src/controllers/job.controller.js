const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Campus = require('../models/Campus');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { buildJobCampusCityFilter } = require('../utils/jobScope');
const { ROLES, JOB_TYPES, JOB_STATUSES } = require('../utils/constants');

// The create/edit form now submits multipart (title/description/etc. +
// optional image file), so array fields (skills/languages/links/
// requirements) arrive as comma-separated strings, same convention
// applicantPortal.controller.js's own toArray already uses for the
// Application form's skills/languages/links. Also accepts an already-real
// array so nothing breaks if a caller ever sends plain JSON instead.
const toArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

// FormData stringifies booleans ("true"/"false") — Boolean('false') is
// `true`, so a plain Boolean() coercion silently breaks an unchecked
// checkbox. This is the correct coercion for both a real boolean (JSON
// callers) and its FormData string form.
const toBool = (value) => value === true || value === 'true';

// Deletes a previously-uploaded /uploads/... file. Same fire-and-forget
// pattern as auth.controller.js's own avatar replace/remove (fs.unlink with
// a no-op callback — a failed delete of an old file is never worth failing
// the request over).
const deleteUploadedFile = (relativePath) => {
  if (!relativePath) return;
  const absolutePath = path.join(__dirname, '..', relativePath.replace(/^\/?uploads\//, 'uploads/'));
  fs.unlink(absolutePath, () => {});
};

// Super Admin + Admin (Campus Admin) job management. Super Admin has full
// access to every job. Admin/Campus Admin is READ-ONLY — view only the
// jobs matching the campus currently selected on the Admin Portal's Campus
// Selector, OR that campus's city (Job.campus/Job.city vs. the selected
// Campus); create/update/delete/publish are blocked at the permission grid
// itself (seed.js's ADMIN role now grants only 'jobs' view, never
// create/update/delete — see checkPermission in job.routes.js), not left
// to a controller-level ownership check. `canManageJob`/`getAdminJobScope`
// below are the two enforcement points: the former is now effectively
// Super-Admin-only in practice (kept for the `canManage` display hint the
// UI already reads), the latter is the new view-scope restriction.

const POPULATE = [
  { path: 'createdBy', select: 'name' },
  { path: 'updatedBy', select: 'name' },
  { path: 'campus', select: 'name' },
];

// True for Super Admin (always) or the Admin who created this job — kept
// as the `canManage` display hint the Jobs table reads to show/hide row
// actions, but never the real gate: create/update/delete now require the
// 'jobs' create/update/delete permission, which Admin's role no longer
// grants at all (see seed.js), so this can never actually authorize a
// mutation for Admin in practice even though the check still exists here.
// Never derived from anything the client sends. job.createdBy may be a raw
// ObjectId (updateJob/deleteJob fetch it unpopulated, since only the id
// comparison matters there) or an already-populated {_id, name} object
// (getJobs/getJob populate it for display) — handled either way.
const canManageJob = (req, job) => {
  if (req.user.role === ROLES.SUPER_ADMIN) return true;
  const creatorId = job.createdBy?._id || job.createdBy;
  return creatorId?.toString() === req.user._id.toString();
};

// Campus Admin's job VIEW is scoped to the campus CURRENTLY SELECTED on the
// shared Admin Portal Campus Selector — read the same way every other
// Admin Portal list endpoint reads it (a `campus` query param on GET, or
// body field on POST; see campusScope.js's requireAdminCampusScope, the
// exact same convention used by Students/Attendance/Dashboard/etc. — Job
// Portal now matches it instead of the fixed-to-User.campus rule this used
// to have). Jobs explicitly tagged with that campus (Job.campus), OR
// posted for that campus's city with no specific campus pinned (Job.city
// is free text — see Job.js — since a job can be posted for a city
// without tying it to one particular campus there), are in scope. Either
// is enough; a job tagged for a different campus with a city that doesn't
// match the selected one never appears — switching the selector to a
// different campus/city can never surface a job from the previous one.
// The actual filter-building (Campus -> City lookup + the city regex) is
// shared with dashboard.controller.js's Job Applications stat via
// utils/jobScope.js, so the two can never scope jobs differently.
// Returns undefined for Super Admin (unscoped/global, unaffected) and, for
// an Admin with no campus selected/requested, or one that doesn't resolve
// to a real Campus, a filter that matches nothing — a sentinel id — so
// they read zero jobs rather than ever falling through to global data or
// silently keeping a stale selection.
const getAdminJobScope = async (req) => {
  if (req.user.role !== ROLES.ADMIN) return undefined;

  const requestedCampusId = req.query.campus || req.body?.campus;
  const filter = await buildJobCampusCityFilter(requestedCampusId);
  return filter || { campus: new mongoose.Types.ObjectId() };
};

const validateDates = (openingDate, closingDate) => {
  if (openingDate && closingDate && new Date(closingDate) <= new Date(openingDate)) {
    return 'Closing date must be after opening date';
  }
  return null;
};

// @desc    List jobs — Super Admin sees every job; Admin (Campus Admin)
//          only sees jobs matching the currently-selected Campus Selector
//          campus or its city (read-only — see the module-level comment
//          above).
// @route   GET /api/jobs
// @access  Private (SUPER_ADMIN, ADMIN — 'jobs' view permission)
const getJobs = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (req.query.status && JOB_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.jobType && JOB_TYPES.includes(req.query.jobType)) filter.jobType = req.query.jobType;
  const adminScope = await getAdminJobScope(req);
  if (adminScope) Object.assign(filter, adminScope);

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
  // Same 404-not-403 discipline used for Applicant ownership elsewhere in
  // this app — a job outside this Admin's currently-selected campus/city
  // scope returns the exact same 404 as a nonexistent id, never revealing
  // that it exists.
  const adminScope = await getAdminJobScope(req);
  if (adminScope) {
    const inScope = await Job.exists({ _id: job._id, ...adminScope });
    if (!inScope) {
      res.status(404);
      throw new Error('Job not found');
    }
  }
  res.json({ success: true, data: { ...job.toObject(), canManage: canManageJob(req, job) } });
});

const createJob = asyncHandler(async (req, res) => {
  const {
    title,
    jobType,
    city,
    campus,
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
  if (campus) {
    const exists = await Campus.findById(campus);
    if (!exists) {
      res.status(400);
      throw new Error('Selected campus does not exist');
    }
  }
  const dateError = validateDates(openingDate, closingDate);
  if (dateError) {
    res.status(400);
    throw new Error(dateError);
  }

  // Creating a job never auto-publishes it — defaults to 'draft' unless
  // explicitly set, same "don't auto-approve" caution used for
  // Enrollment/Application status elsewhere in this app. The image is
  // always optional — a job can be published (status='open') with or
  // without one; nothing here blocks that.
  const finalStatus = status || 'draft';
  const image = req.file ? `/uploads/${req.file.filename}` : undefined;

  // createdBy/updatedBy always the authenticated caller — never accepted
  // from the request body, so a job can never be created "as" someone else.
  const job = await Job.create({
    title,
    jobType,
    city,
    campus: campus || undefined,
    image,
    experience,
    qualification,
    about,
    subjectCommand,
    skills: toArray(skills),
    expectedSalary,
    languages: toArray(languages),
    links: toArray(links),
    description,
    requirements: toArray(requirements),
    openingDate: openingDate || undefined,
    closingDate: closingDate || undefined,
    status: finalStatus,
    resumeRequired: resumeRequired === undefined ? true : toBool(resumeRequired),
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
    city,
    campus,
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
    // Sent by the edit form's "remove image" action (mirrors auth.
    // controller.js's own removeAvatar) — only takes effect when no new
    // file was uploaded in the same request; a fresh upload always wins.
    removeImage,
  } = req.body;

  if (jobType !== undefined && !JOB_TYPES.includes(jobType)) {
    res.status(400);
    throw new Error('Invalid job type');
  }
  if (status !== undefined && !JOB_STATUSES.includes(status)) {
    res.status(400);
    throw new Error('Invalid job status');
  }
  if (campus) {
    const exists = await Campus.findById(campus);
    if (!exists) {
      res.status(400);
      throw new Error('Selected campus does not exist');
    }
  }
  const dateError = validateDates(
    openingDate !== undefined ? openingDate : job.openingDate,
    closingDate !== undefined ? closingDate : job.closingDate
  );
  if (dateError) {
    res.status(400);
    throw new Error(dateError);
  }

  // Resolve what the image will be AFTER this request, without touching
  // the document yet — a new upload always wins, then an explicit removal,
  // else the job keeps whatever it already had. Always optional — a job
  // can be published (status='open') with or without one.
  const newImage = req.file ? `/uploads/${req.file.filename}` : undefined;
  const willRemoveImage = !newImage && toBool(removeImage);

  if (title !== undefined) job.title = title;
  if (jobType !== undefined) job.jobType = jobType;
  if (city !== undefined) job.city = city;
  if (campus !== undefined) job.campus = campus || undefined;
  if (experience !== undefined) job.experience = experience;
  if (qualification !== undefined) job.qualification = qualification;
  if (about !== undefined) job.about = about;
  if (subjectCommand !== undefined) job.subjectCommand = subjectCommand;
  if (skills !== undefined) job.skills = toArray(skills);
  if (expectedSalary !== undefined) job.expectedSalary = expectedSalary;
  if (languages !== undefined) job.languages = toArray(languages);
  if (links !== undefined) job.links = toArray(links);
  if (description !== undefined) job.description = description;
  if (requirements !== undefined) job.requirements = toArray(requirements);
  if (openingDate !== undefined) job.openingDate = openingDate || undefined;
  if (closingDate !== undefined) job.closingDate = closingDate || undefined;
  if (status !== undefined) job.status = status;
  if (resumeRequired !== undefined) job.resumeRequired = toBool(resumeRequired);
  if (newImage) {
    deleteUploadedFile(job.image);
    job.image = newImage;
  } else if (willRemoveImage) {
    deleteUploadedFile(job.image);
    job.image = undefined;
  }
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
