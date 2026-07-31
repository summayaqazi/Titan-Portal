const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true, index: true },
    specialization: [{ type: String, trim: true }],
    qualification: { type: String, trim: true },
    cnic: { type: String, trim: true },
    joiningDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trainer', trainerSchema);
