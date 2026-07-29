const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'online', 'other'],
      default: 'cash',
    },
    installmentNumber: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'refunded'],
      default: 'paid',
    },
    dueDate: { type: Date },
    paidDate: { type: Date },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
