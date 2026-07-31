const asyncHandler = require('express-async-handler');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');
const User = require('../models/User');
const { ROLES } = require('../utils/constants');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const POPULATE = [
  { path: 'student', populate: { path: 'user', select: 'name email' } },
  { path: 'enrollment', populate: [{ path: 'course', select: 'name code' }, { path: 'batch', select: 'batchCode' }] },
  { path: 'receivedBy', select: 'name' },
];

const getPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip, search } = parseListQuery(req);

  const filter = {};
  if (req.query.student) filter.student = req.query.student;
  if (req.query.status) filter.status = req.query.status;

  if (search) {
    const matchingUsers = await User.find({
      role: ROLES.STUDENT,
      name: { $regex: search, $options: 'i' },
    }).select('_id');
    const matchingStudents = await Student.find({ user: { $in: matchingUsers.map((u) => u._id) } }).select('_id');
    filter.student = { $in: matchingStudents.map((s) => s._id) };
  }

  const [items, total] = await Promise.all([
    Payment.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const createPayment = asyncHandler(async (req, res) => {
  const { enrollment, amount, method, installmentNumber, status, dueDate, paidDate, remarks } = req.body;

  if (!enrollment || !amount) {
    res.status(400);
    throw new Error('Enrollment and amount are required');
  }
  if (amount <= 0) {
    res.status(400);
    throw new Error('Amount must be greater than zero');
  }

  const enrollmentDoc = await Enrollment.findById(enrollment);
  if (!enrollmentDoc) {
    res.status(400);
    throw new Error('Selected enrollment does not exist');
  }

  const payment = await Payment.create({
    enrollment,
    student: enrollmentDoc.student,
    amount,
    method,
    installmentNumber,
    status: status || 'pending',
    dueDate,
    paidDate: status === 'paid' ? paidDate || new Date() : paidDate,
    receivedBy: req.user._id,
    remarks,
  });

  res.status(201).json({ success: true, data: await payment.populate(POPULATE) });
});

const updatePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  const { amount, method, installmentNumber, status, dueDate, paidDate, remarks } = req.body;

  if (amount !== undefined) {
    if (amount <= 0) {
      res.status(400);
      throw new Error('Amount must be greater than zero');
    }
    payment.amount = amount;
  }
  if (method !== undefined) payment.method = method;
  if (installmentNumber !== undefined) payment.installmentNumber = installmentNumber;
  if (dueDate !== undefined) payment.dueDate = dueDate;
  if (remarks !== undefined) payment.remarks = remarks;
  if (status !== undefined) {
    payment.status = status;
    if (status === 'paid' && !payment.paidDate) {
      payment.paidDate = paidDate || new Date();
      payment.receivedBy = req.user._id;
    }
  }
  if (paidDate !== undefined) payment.paidDate = paidDate;

  await payment.save();
  res.json({ success: true, data: await payment.populate(POPULATE) });
});

const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  await payment.deleteOne();
  res.json({ success: true, message: 'Payment deleted' });
});

module.exports = { getPayments, createPayment, updatePayment, deletePayment };
