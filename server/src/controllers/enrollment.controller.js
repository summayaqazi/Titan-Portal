const asyncHandler = require('express-async-handler');
const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const { ENROLLMENT_STATUSES } = require('../utils/constants');

const POPULATE = [
  { path: 'student', populate: { path: 'user', select: 'name email' } },
  { path: 'course', select: 'name code' },
  { path: 'batch', select: 'batchCode' },
  { path: 'campus', select: 'name' },
  { path: 'trainer', populate: { path: 'user', select: 'name' } },
  { path: 'slot', select: 'label' },
];

const getStudentEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.params.studentId })
    .populate(POPULATE)
    .sort({ admissionDate: -1 });

  res.json({ success: true, data: enrollments });
});

const createEnrollment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const { course, batch, rollNumber, status, paymentStatus } = req.body;

  if (!course || !batch) {
    res.status(400);
    throw new Error('Course and batch are required');
  }

  const [courseExists, batchDoc] = await Promise.all([Course.findById(course), Batch.findById(batch)]);
  if (!courseExists) {
    res.status(400);
    throw new Error('Selected course does not exist');
  }
  if (!batchDoc) {
    res.status(400);
    throw new Error('Selected batch does not exist');
  }

  const existing = await Enrollment.findOne({ student: student._id, course, batch });
  if (existing) {
    res.status(400);
    throw new Error('This student is already enrolled in this course batch');
  }

  const initialStatus = status || 'pending';

  const enrollment = await Enrollment.create({
    student: student._id,
    course,
    batch,
    campus: batchDoc.campus,
    trainer: batchDoc.trainer,
    slot: batchDoc.slot,
    rollNumber,
    status: initialStatus,
    paymentStatus,
    history: [{ status: initialStatus, changedBy: req.user._id, note: 'Enrollment created' }],
  });

  res.status(201).json({ success: true, data: await enrollment.populate(POPULATE) });
});

const updateEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.id);
  if (!enrollment) {
    res.status(404);
    throw new Error('Enrollment not found');
  }

  const { status, paymentStatus, rollNumber, note } = req.body;

  if (status !== undefined) {
    if (!ENROLLMENT_STATUSES.includes(status)) {
      res.status(400);
      throw new Error('Invalid enrollment status');
    }
    if (status !== enrollment.status) {
      enrollment.history.push({ status, note, changedBy: req.user._id });
    }
    enrollment.status = status;
  }
  if (paymentStatus !== undefined) enrollment.paymentStatus = paymentStatus;
  if (rollNumber !== undefined) enrollment.rollNumber = rollNumber;

  await enrollment.save();
  res.json({ success: true, data: await enrollment.populate(POPULATE) });
});

const deleteEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.id);
  if (!enrollment) {
    res.status(404);
    throw new Error('Enrollment not found');
  }

  await enrollment.deleteOne();
  res.json({ success: true, message: 'Enrollment deleted' });
});

module.exports = { getStudentEnrollments, createEnrollment, updateEnrollment, deleteEnrollment };
