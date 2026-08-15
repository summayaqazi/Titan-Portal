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

    // Face + Location Attendance — a 128-dimension face-api.js descriptor
    // (a mathematical representation, never a raw photo/frame), captured
    // client-side from a live, liveness-checked camera capture and
    // compared server-side on every self-check-in. `select: false` so it's
    // never returned by any existing/future query (including the ones this
    // feature itself doesn't explicitly opt into it) unless a controller
    // deliberately asks for it via .select('+faceDescriptor') — defense in
    // depth against ever leaking it to a client response by accident.
    faceDescriptor: { type: [Number], select: false },
    faceEnrolledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trainer', trainerSchema);
