const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, unique: true }, // e.g. "Morning 9-11"
    startTime: { type: String, required: true }, // "09:00"
    endTime: { type: String, required: true }, // "11:00"
    days: [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Slot', slotSchema);
