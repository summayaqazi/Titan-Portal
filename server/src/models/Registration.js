const mongoose = require('mongoose');
const { REGISTRATION_STATUSES } = require('../utils/constants');

// A Student Registration — everything a visitor submits on the public
// course-registration form (server/src/controllers/public.controller.js),
// held here for Super Admin review BEFORE any User/Student account exists.
// This is the deliberate architectural boundary the Students module and the
// Registrations module sit on either side of:
//   - Registration = "someone applied to become a student." Reviewed here,
//     approved or rejected. Nothing else in the app references this
//     person until a Super Admin approves it.
//   - Student = an approved, real student account (User + Student +
//     Enrollment), managed entirely by the existing Students module
//     (student.controller.js, Students.jsx, StudentDetailDrawer.jsx) —
//     completely untouched by this file.
// A Registration is never itself "the student record" and never gets
// mutated into one — approval CREATES a separate Student (see
// registration.controller.js's updateRegistrationStatus), leaving this
// document as a permanent audit trail of the original submission
// (`student` below points at what it became, once it becomes something).
const registrationHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: REGISTRATION_STATUSES, required: true },
    note: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// A "visit" — staff opening/reviewing this registration's own record. Logged
// automatically (registration.controller.js's logRegistrationVisit) by the
// EXISTING "Review" click on the Registrations page/detail drawer — there is
// no separate Visitor button, page, or top-level collection; this is the
// Visitor API's entire footprint, folded straight into the Registration
// module it belongs to.
const registrationVisitSchema = new mongoose.Schema(
  {
    visitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    visitedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    // --- Everything below mirrors the fields Student/User would otherwise
    // hold, because until approval there IS no Student/User to hold them.
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    // Bcrypt-hashed at submission time (public.controller.js), never stored
    // plaintext — see User.js's own pre-save hook for how this gets reused
    // unchanged when a User is finally created on approval, instead of
    // being hashed a second time.
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    cnic: { type: String, trim: true },
    fatherCnic: { type: String, trim: true },
    fatherContactNumber: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: { type: String, trim: true },
    highestQualification: {
      type: String,
      enum: ['matric', 'intermediate', 'bachelors', 'masters', 'other'],
    },
    computerProficiency: { type: String, enum: ['none', 'basic', 'intermediate', 'advanced'] },
    laptopAvailability: { type: Boolean },
    // Public path (server/src/uploads/, mounted by express.static) — same
    // convention as every other profile-picture upload in the app. Carried
    // over verbatim to Student.profilePicture on approval.
    profilePicture: { type: String },

    // --- What they registered for. Copied onto the new Enrollment on
    // approval exactly like registerAndEnroll used to do directly.
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },

    status: { type: String, enum: REGISTRATION_STATUSES, default: 'pending' },
    history: [registrationHistorySchema],
    // One entry per time staff opened this registration to review it — see
    // registrationVisitSchema above.
    visits: [registrationVisitSchema],

    // Set only once, at approval (updateRegistrationStatus) — both an audit
    // trail ("what did this become?") and the idempotency guard that stops
    // an already-approved Registration from ever being promoted twice.
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// Friendly duplicate-submission guard, same {relationship-key} unique-index
// convention as Application's {applicant, job} and Enrollment's {student,
// course, batch} — one registration per person per course/batch, regardless
// of its eventual status (mirrors Application: once submitted, it's
// reviewed, never silently replaced by a second submission).
registrationSchema.index({ email: 1, course: 1, batch: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
