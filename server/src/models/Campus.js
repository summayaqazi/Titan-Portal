const mongoose = require('mongoose');

const campusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    address: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    isActive: { type: Boolean, default: true },

    // Optional — unset for any campus created before the Trainer Face +
    // Location Attendance feature. Trainer self-check-in requires both to
    // be set (a clear "not configured" error is shown otherwise); nothing
    // else in the app reads or requires these.
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    // Geofence radius for trainer self-check-in, in meters. Defaulted so a
    // campus that only ever sets lat/lng still gets a sane radius.
    attendanceRadiusMeters: { type: Number, default: 200, min: 10 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campus', campusSchema);
