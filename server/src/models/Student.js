const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    fatherName: { type: String, trim: true },
    cnic: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: { type: String, trim: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', index: true },
    profilePicture: { type: String },
    isActive: { type: Boolean, default: true },

    employmentStatus: {
      type: String,
      enum: ['unemployed', 'employed', 'self_employed', 'student'],
    },
    organization: { type: String, trim: true },
    designation: { type: String, trim: true },
    monthlyIncome: { type: Number, min: 0 },

    highestQualification: {
      type: String,
      enum: ['matric', 'intermediate', 'bachelors', 'masters', 'other'],
    },
    institute: { type: String, trim: true },
    yearOfCompletion: { type: Number },

    cnicVerified: { type: Boolean, default: false },
    cnicVerifiedAt: { type: Date },
    cnicVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
