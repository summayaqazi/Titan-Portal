const mongoose = require('mongoose');

// Job Portal — a job applicant's identity record. Intentionally thin,
// mirroring Student.js's own {user} + status shape: a job applicant is NOT
// a Student (separate collection, separate role, no shared fields), and
// per-application details (qualification, experience, skills, resume, ...)
// belong on Application, not here — those vary application to application,
// this is only the stable "who is this person" anchor an Applicant's many
// Applications hang off of.
const applicantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Applicant', applicantSchema);
