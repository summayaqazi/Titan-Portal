// Restores ONLY missing Payment records for enrollments that have none —
// manual, idempotent, safe to re-run. Reuses the exact invoice-numbering
// logic from payment.controller.js rather than duplicating it. Never
// modifies Enrollment, Student, Course, or any other collection — every
// enrollment's existing `paymentStatus` is read-only input, not changed.
//
// For each enrollment with zero Payment records, recreates payment rows
// consistent with its existing paymentStatus (course.fee is the amount
// basis):
//   paid    -> one 'paid' payment for the full fee
//   pending -> one 'pending' payment for the full fee
//   partial -> two installments: half paid, half still pending
// Any other status (overdue/refunded/waived) falls back to a single
// payment mirroring that status, so no enrollment is silently skipped.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const User = require('../models/User');
require('../models/Course'); // registers the Course schema for .populate('course')
const { ROLES } = require('./constants');
const { generateInvoiceNumber } = require('../controllers/payment.controller');

const PAYMENT_STATUS_MAP = {
  paid: 'paid',
  pending: 'pending',
  overdue: 'overdue',
  refunded: 'refunded',
  waived: 'paid', // no 'waived' concept on Payment — a waived fee is recorded as settled.
};

const seedPayments = async () => {
  const receiver = await User.findOne({ role: ROLES.SUPER_ADMIN });
  if (!receiver) {
    console.log('No Super Admin user found — cannot attribute recreated payments to a receivedBy user. Aborting.');
    return { created: 0, skipped: 0, enrollmentsWithoutFee: 0 };
  }

  const enrollments = await Enrollment.find().populate('course', 'fee');

  let created = 0;
  let skipped = 0;
  let enrollmentsWithoutFee = 0;

  for (const enrollment of enrollments) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Payment.findOne({ enrollment: enrollment._id });
    if (existing) {
      skipped += 1;
      continue;
    }

    const fee = enrollment.course?.fee;
    if (!fee) {
      enrollmentsWithoutFee += 1;
      continue;
    }

    const admissionDate = enrollment.admissionDate || new Date();
    const monthLabel = `${admissionDate.getFullYear()}-${String(admissionDate.getMonth() + 1).padStart(2, '0')}`;

    if (enrollment.paymentStatus === 'partial') {
      const half = Math.floor(fee / 2);
      const remainder = fee - half;
      // eslint-disable-next-line no-await-in-loop
      await Payment.create({
        enrollment: enrollment._id,
        student: enrollment.student,
        amount: half,
        status: 'paid',
        installmentNumber: 1,
        feeType: 'installment',
        paidDate: admissionDate,
        receivedBy: receiver._id,
        // eslint-disable-next-line no-await-in-loop
        invoiceNumber: await generateInvoiceNumber(admissionDate),
      });
      // eslint-disable-next-line no-await-in-loop
      await Payment.create({
        enrollment: enrollment._id,
        student: enrollment.student,
        amount: remainder,
        status: 'pending',
        installmentNumber: 2,
        feeType: 'installment',
        dueDate: new Date(admissionDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        receivedBy: receiver._id,
        // eslint-disable-next-line no-await-in-loop
        invoiceNumber: await generateInvoiceNumber(admissionDate),
      });
      created += 2;
      continue;
    }

    const status = PAYMENT_STATUS_MAP[enrollment.paymentStatus] || 'pending';
    // eslint-disable-next-line no-await-in-loop
    await Payment.create({
      enrollment: enrollment._id,
      student: enrollment.student,
      amount: fee,
      status,
      feeType: 'monthly',
      month: monthLabel,
      paidDate: status === 'paid' ? admissionDate : undefined,
      dueDate: status !== 'paid' ? admissionDate : undefined,
      receivedBy: receiver._id,
      // eslint-disable-next-line no-await-in-loop
      invoiceNumber: await generateInvoiceNumber(admissionDate),
    });
    created += 1;
  }

  return { created, skipped, enrollmentsWithoutFee, totalEnrollments: enrollments.length };
};

const run = async () => {
  await connectDB();
  const summary = await seedPayments();
  console.log('Payment restore summary (safe to re-run — enrollments that already have a payment are skipped):');
  console.log(summary);
  await mongoose.connection.close();
  process.exit(0);
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seedPayments };
