const mongoose = require('mongoose');

const trainerAttendanceSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    date: { type: Date, required: true },

    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date },
    durationMinutes: { type: Number },

    // Derived from the batch's slot start time at check-in — a grace period
    // is applied before a check-in counts as late.
    expectedStartTime: { type: String },
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },

    // Every check-in starts as a "request" awaiting Super Admin verification,
    // since there is no Trainer Portal for trainers to self-certify yet.
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },

    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

trainerAttendanceSchema.index({ trainer: 1, batch: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TrainerAttendance', trainerAttendanceSchema);
