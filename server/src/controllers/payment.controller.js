const asyncHandler = require('express-async-handler');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');
const User = require('../models/User');
const { ROLES } = require('../utils/constants');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { nextSequence } = require('../models/Counter');
const { invoicePdf, receiptPdf } = require('../utils/pdfGenerator');

const POPULATE = [
  { path: 'student', populate: { path: 'user', select: 'name email' } },
  { path: 'enrollment', populate: [{ path: 'course', select: 'name code fee' }, { path: 'batch', select: 'batchCode' }] },
  { path: 'receivedBy', select: 'name' },
];

const monthKey = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

const generateInvoiceNumber = async (date = new Date()) => {
  const ym = monthKey(date);
  const seq = await nextSequence(`invoice-${ym}`);
  return `INV-${ym}-${String(seq).padStart(4, '0')}`;
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const currentMonthLabel = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip, search } = parseListQuery(req);

  const filter = {};
  if (req.query.student) filter.student = req.query.student;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.feeType) filter.feeType = req.query.feeType;
  if (req.query.dueFrom || req.query.dueTo) {
    filter.dueDate = {};
    if (req.query.dueFrom) filter.dueDate.$gte = new Date(req.query.dueFrom);
    if (req.query.dueTo) filter.dueDate.$lte = new Date(req.query.dueTo);
  }

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
  const { enrollment, amount, method, installmentNumber, status, dueDate, paidDate, remarks, feeType, month } =
    req.body;

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

  const resolvedFeeType = feeType || 'monthly';
  const resolvedMonth = resolvedFeeType === 'monthly' ? month || currentMonthLabel() : undefined;

  if (resolvedFeeType === 'monthly') {
    const duplicate = await Payment.findOne({ enrollment, feeType: 'monthly', month: resolvedMonth });
    if (duplicate) {
      res.status(400);
      throw new Error(`A monthly fee payment for ${resolvedMonth} already exists for this enrollment`);
    }
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
    feeType: resolvedFeeType,
    month: resolvedMonth,
    invoiceNumber: await generateInvoiceNumber(),
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

// Generates a fixed-size installment plan for an enrollment: N sequential
// pending payments spaced one month apart, splitting totalAmount evenly (the
// last installment absorbs any rounding remainder).
const generatePlan = asyncHandler(async (req, res) => {
  const { enrollment, totalAmount, installments, startDate } = req.body;

  if (!enrollment || !totalAmount || !installments) {
    res.status(400);
    throw new Error('Enrollment, total amount and number of installments are required');
  }
  if (totalAmount <= 0 || installments < 1 || !Number.isInteger(Number(installments))) {
    res.status(400);
    throw new Error('Total amount must be positive and installments must be a whole number of at least 1');
  }

  const enrollmentDoc = await Enrollment.findById(enrollment);
  if (!enrollmentDoc) {
    res.status(400);
    throw new Error('Selected enrollment does not exist');
  }

  const existingPlan = await Payment.findOne({ enrollment, feeType: 'installment' });
  if (existingPlan) {
    res.status(400);
    throw new Error('An installment plan already exists for this enrollment');
  }

  const start = startDate ? new Date(startDate) : new Date();
  const baseAmount = Math.floor(totalAmount / installments);
  const remainder = totalAmount - baseAmount * installments;

  const created = [];
  for (let i = 0; i < installments; i += 1) {
    const amount = i === installments - 1 ? baseAmount + remainder : baseAmount;
    // eslint-disable-next-line no-await-in-loop
    const payment = await Payment.create({
      enrollment,
      student: enrollmentDoc.student,
      amount,
      installmentNumber: i + 1,
      status: 'pending',
      dueDate: addMonths(start, i),
      receivedBy: req.user._id,
      feeType: 'installment',
      // eslint-disable-next-line no-await-in-loop
      invoiceNumber: await generateInvoiceNumber(),
    });
    created.push(payment);
  }

  const populated = await Payment.find({ _id: { $in: created.map((p) => p._id) } }).populate(POPULATE);
  res.status(201).json({ success: true, data: populated });
});

const getInvoice = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate(POPULATE);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  invoicePdf(res, { payment, student: payment.student, enrollment: payment.enrollment });
});

const getReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate(POPULATE);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  if (payment.status !== 'paid') {
    res.status(400);
    throw new Error('Receipts are only available for paid payments');
  }
  receiptPdf(res, { payment, student: payment.student, enrollment: payment.enrollment });
});

// Creates next month's monthly-fee payment from a prior one (same
// enrollment/amount), only once the prior one has been paid or has gone
// overdue — prevents generating an unbounded run of future invoices.
const regeneratePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  if (payment.feeType !== 'monthly') {
    res.status(400);
    throw new Error('Only monthly fee payments can be regenerated');
  }
  if (!['paid', 'overdue'].includes(payment.status)) {
    res.status(400);
    throw new Error('Only a paid or overdue monthly fee can be regenerated');
  }

  const baseDate = payment.month ? new Date(`${payment.month}-01`) : new Date();
  const nextDate = addMonths(baseDate, 1);
  const nextMonth = currentMonthLabel(nextDate);

  const duplicate = await Payment.findOne({ enrollment: payment.enrollment, feeType: 'monthly', month: nextMonth });
  if (duplicate) {
    res.status(400);
    throw new Error(`A monthly fee payment for ${nextMonth} already exists for this enrollment`);
  }

  const nextDueDate = payment.dueDate ? addMonths(payment.dueDate, 1) : addMonths(new Date(), 1);

  const created = await Payment.create({
    enrollment: payment.enrollment,
    student: payment.student,
    amount: payment.amount,
    method: payment.method,
    status: 'pending',
    dueDate: nextDueDate,
    receivedBy: req.user._id,
    feeType: 'monthly',
    month: nextMonth,
    invoiceNumber: await generateInvoiceNumber(),
  });

  res.status(201).json({ success: true, data: await created.populate(POPULATE) });
});

module.exports = {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  generatePlan,
  getInvoice,
  getReceipt,
  regeneratePayment,
  // Exposed for reuse by the payments-only restore script (utils/seedPaymentsOnly.js)
  // so invoice numbering stays the exact same logic, not a second implementation.
  generateInvoiceNumber,
  currentMonthLabel,
};
