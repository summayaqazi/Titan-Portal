const mongoose = require('mongoose');
const { ENROLLMENT_STATUSES } = require('../utils/constants');

const enrollmentHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ENROLLMENT_STATUSES, required: true },
    note: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
    rollNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: ENROLLMENT_STATUSES,
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue', 'refunded', 'waived'],
      default: 'pending',
    },
    admissionDate: { type: Date, default: Date.now },
    history: [enrollmentHistorySchema],
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, course: 1, batch: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
