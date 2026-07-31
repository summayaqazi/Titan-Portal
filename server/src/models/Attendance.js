const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'leave', 'late'],
      required: true,
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ enrollment: 1, date: 1 }, { unique: true });
// Speeds up building the attendance roster (find already-marked records for a
// batch on a given day) and the attendance history list's date-range filter.
attendanceSchema.index({ batch: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
