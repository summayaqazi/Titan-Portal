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

    // Optional — only ever set by the Trainer Portal's own self-check-in
    // (trainerSelfAttendance.controller.js) or the QR scanner below. Left
    // undefined for every record created via the existing Admin/Super Admin
    // manual checkIn above, which is untouched by this feature.
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus' },
    verification: {
      // 'self-verified': created by markOwnAttendance (face + location +
      // schedule all passed server-side). 'qr-scan': created by Admin/Super
      // Admin scanning the trainer's own ID Card QR (see
      // utils/trainerQrAttendance.js) — an admin-witnessed identity check,
      // not a biometric one. 'manual': everything else, including every
      // record that existed before this feature shipped.
      method: { type: String, enum: ['self-verified', 'qr-scan', 'manual'], default: 'manual' },
      face: {
        matched: { type: Boolean },
        distance: { type: Number },
        livenessPassed: { type: Boolean },
      },
      location: {
        matched: { type: Boolean },
        distanceMeters: { type: Number },
        lat: { type: Number },
        lng: { type: Number },
      },
    },
  },
  { timestamps: true }
);

trainerAttendanceSchema.index({ trainer: 1, batch: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TrainerAttendance', trainerAttendanceSchema);
