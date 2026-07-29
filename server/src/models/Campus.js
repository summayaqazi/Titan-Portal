const mongoose = require('mongoose');

const campusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    address: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campus', campusSchema);
