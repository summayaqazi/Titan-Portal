const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    batchCode: { type: String, required: true, unique: true, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true, index: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    capacity: { type: Number, default: 30, min: 1 },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
      index: true,
    },
    // Whether this batch is currently accepting new student registrations.
    registrationOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Batch', batchSchema);
