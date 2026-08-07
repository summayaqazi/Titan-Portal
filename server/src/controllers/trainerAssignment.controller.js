const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const unlinkUpload = (filePath) => {
  if (!filePath) return;
  const full = path.join(__dirname, '..', filePath.replace('/uploads/', 'uploads/'));
  fs.unlink(full, () => {});
};

// Same single-vs-array multer/FormData quirk handled the same way as
// trainer.controller.js's toArray — a field sent once arrives as a plain
// string, sent 2+ times as an array.
const toArray = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
};

// @desc    List this trainer's assignments for one batch.
// @route   GET /api/trainer/me/courses/:batchId/assignments?page=&limit=&search=
// @access  Private (TRAINER)
const getAssignments = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = { batch: req.batch._id };
  if (search) filter.title = { $regex: search, $options: 'i' };

  const [items, total] = await Promise.all([
    Assignment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Assignment.countDocuments(filter),
  ]);

  // Submission counts are cheap enough to attach per-page (not per full
  // list) so the Assignment List can show at-a-glance activity.
  const withCounts = await Promise.all(
    items.map(async (a) => ({
      ...a.toObject(),
      submissionCount: await Submission.countDocuments({ assignment: a._id }),
    }))
  );

  res.json(paginatedResponse({ items: withCounts, total, page, limit }));
});

// @desc    Create an assignment for this trainer's own batch.
// @route   POST /api/trainer/me/courses/:batchId/assignments
// @access  Private (TRAINER)
const createAssignment = asyncHandler(async (req, res) => {
  const { title, description, topic, dueDate } = req.body;
  const referenceLinks = toArray(req.body.referenceLinks) || [];

  if (!title) {
    res.status(400);
    throw new Error('Title is required');
  }

  const referenceImages = (req.files?.referenceImages || []).map((f) => `/uploads/${f.filename}`);
  const attachments = (req.files?.attachments || []).map((f) => `/uploads/${f.filename}`);

  const assignment = await Assignment.create({
    title,
    description,
    referenceLinks,
    referenceImages,
    topic,
    dueDate: dueDate || undefined,
    attachments,
    course: req.batch.course,
    batch: req.batch._id,
    trainer: req.trainer._id,
  });

  res.status(201).json({ success: true, data: assignment });
});

// @desc    Update an assignment. req.assignment is already ownership-verified.
// @route   PUT /api/trainer/me/assignments/:assignmentId
// @access  Private (TRAINER)
const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = req.assignment;
  const { title, description, topic, dueDate } = req.body;
  const referenceLinks = toArray(req.body.referenceLinks);

  if (title !== undefined) assignment.title = title;
  if (description !== undefined) assignment.description = description;
  if (topic !== undefined) assignment.topic = topic;
  if (dueDate !== undefined) assignment.dueDate = dueDate || undefined;
  if (referenceLinks !== undefined) assignment.referenceLinks = referenceLinks;

  // New files are appended; explicit removal lists let the form drop
  // individual existing files without resending everything.
  const removeReferenceImages = toArray(req.body.removeReferenceImages) || [];
  const removeAttachments = toArray(req.body.removeAttachments) || [];

  if (removeReferenceImages.length) {
    assignment.referenceImages = assignment.referenceImages.filter((url) => !removeReferenceImages.includes(url));
    removeReferenceImages.forEach(unlinkUpload);
  }
  if (removeAttachments.length) {
    assignment.attachments = assignment.attachments.filter((url) => !removeAttachments.includes(url));
    removeAttachments.forEach(unlinkUpload);
  }

  const newReferenceImages = (req.files?.referenceImages || []).map((f) => `/uploads/${f.filename}`);
  const newAttachments = (req.files?.attachments || []).map((f) => `/uploads/${f.filename}`);
  assignment.referenceImages = [...assignment.referenceImages, ...newReferenceImages];
  assignment.attachments = [...assignment.attachments, ...newAttachments];

  await assignment.save();
  res.json({ success: true, data: assignment });
});

// @desc    Delete an assignment (and its uploaded files). Submissions
//          against it are deleted too — they're meaningless orphaned once
//          the assignment they answer no longer exists.
// @route   DELETE /api/trainer/me/assignments/:assignmentId
// @access  Private (TRAINER)
const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = req.assignment;

  assignment.referenceImages.forEach(unlinkUpload);
  assignment.attachments.forEach(unlinkUpload);

  const submissions = await Submission.find({ assignment: assignment._id });
  submissions.forEach((s) => s.files.forEach(unlinkUpload));
  await Submission.deleteMany({ assignment: assignment._id });

  await assignment.deleteOne();
  res.json({ success: true, message: 'Assignment deleted' });
});

// @desc    Submission statistics + full list for one assignment.
// @route   GET /api/trainer/me/assignments/:assignmentId/submissions?search=
// @access  Private (TRAINER)
const getSubmissions = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim().toLowerCase();

  const submissions = await Submission.find({ assignment: req.assignment._id })
    .populate({ path: 'student', populate: { path: 'user', select: 'name email avatar' } })
    .populate('feedbackBy', 'name')
    .sort({ submittedAt: -1 });

  const filtered = search
    ? submissions.filter(
        (s) =>
          s.student?.user?.name?.toLowerCase().includes(search) || s.student?.user?.email?.toLowerCase().includes(search)
      )
    : submissions;

  const dueDate = req.assignment.dueDate;
  const stats = {
    total: submissions.length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
    // Independent of status — a submission can be both late and approved.
    late: dueDate ? submissions.filter((s) => s.submittedAt && s.submittedAt > dueDate).length : 0,
  };

  res.json({ success: true, data: { stats, submissions: filtered } });
});

// @desc    Approve/reject a submission with optional feedback. Ownership is
//          verified via the submission's own assignment, since the route is
//          addressed by submissionId (an assignmentId-scoped nested route
//          would be redundant — the assignment link is already unique).
// @route   PUT /api/trainer/me/submissions/:submissionId/review
// @access  Private (TRAINER)
const reviewSubmission = asyncHandler(async (req, res) => {
  const { status, feedback } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error('Status must be approved or rejected');
  }

  const submission = await Submission.findById(req.params.submissionId).populate('assignment');
  if (!submission || String(submission.assignment?.trainer) !== String(req.trainer._id)) {
    res.status(404);
    throw new Error('Submission not found');
  }

  submission.status = status;
  submission.feedback = feedback;
  submission.feedbackBy = req.user._id;
  submission.feedbackAt = new Date();
  await submission.save();
  await submission.populate({ path: 'student', populate: { path: 'user', select: 'name email avatar' } });
  await submission.populate('feedbackBy', 'name');

  res.json({ success: true, data: submission });
});

// @desc    Permanently delete a submission (and its uploaded files).
//          Ownership is verified the exact same way as reviewSubmission —
//          via the submission's own assignment's trainer, never a
//          client-supplied id — so a trainer can only ever delete a
//          submission left by a student enrolled in one of their own
//          assigned courses/batches, never another trainer's.
// @route   DELETE /api/trainer/me/submissions/:submissionId
// @access  Private (TRAINER)
const deleteSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.submissionId).populate('assignment');
  if (!submission || String(submission.assignment?.trainer) !== String(req.trainer._id)) {
    res.status(404);
    throw new Error('Submission not found');
  }

  submission.files.forEach(unlinkUpload);
  await submission.deleteOne();

  res.json({ success: true, message: 'Submission deleted' });
});

module.exports = {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
  reviewSubmission,
  deleteSubmission,
};
