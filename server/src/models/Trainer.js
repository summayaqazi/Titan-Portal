const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    campuses: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campus' }], required: true, index: true },
    specialization: [{ type: String, trim: true }],
    qualification: { type: String, trim: true },
    cnic: { type: String, trim: true },
    joiningDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },

    bio: { type: String },
    socialLinks: {
      linkedin: { type: String, trim: true },
      twitter: { type: String, trim: true },
      facebook: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    hourlyRate: { type: Number, min: 0 },
    profileImage: { type: String },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trainer', trainerSchema);
