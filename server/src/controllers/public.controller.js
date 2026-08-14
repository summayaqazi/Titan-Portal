const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Registration = require('../models/Registration');
const { ROLES } = require('../utils/constants');

// Public-facing (unauthenticated) endpoints for the "discover a course ->
// register -> apply" flow. Deliberately kept separate from
// course.controller.js/student.controller.js/enrollment.controller.js —
// those stay Admin/Super-Admin-only (protect + authorize + checkPermission),
// this file is the one place unauthenticated visitors can reach, and it
// only ever creates data (never lists/exposes anything beyond what's needed
// to browse + apply). It reuses the same Mongoose models and the same
// Enrollment-as-the-relationship domain rule as the rest of the app — no
// second/parallel data store.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same CNIC format the Admin-facing student.controller.js already enforces
// (xxxxx-xxxxxxx-x) — reused verbatim so a student's own CNIC and their
// father's CNIC are validated identically, and so this never drifts from
// the Admin-side rule.
const CNIC_RE = /^\d{5}-\d{7}-\d$/;
// No phone format rule exists anywhere else in the codebase today (every
// other phone/contact-number field in the project is free text) — this is
// intentionally a light sanity check only, not a new strict business rule.
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

const GENDERS = ['male', 'female', 'other'];
const QUALIFICATIONS = ['matric', 'intermediate', 'bachelors', 'masters', 'other'];
const PROFICIENCIES = ['none', 'basic', 'intermediate', 'advanced'];
// A batch only accepts public applications while it's actually upcoming or
// already running, on top of its own `registrationOpen` flag — mirrors how
// the Admin Portal treats those two fields together everywhere else.
const OPEN_BATCH_STATUSES = ['upcoming', 'ongoing'];

const BATCH_PUBLIC_POPULATE = [
  { path: 'campus', select: 'name address city', populate: { path: 'city', select: 'name' } },
  { path: 'slot', select: 'label startTime endTime days' },
  // Trainer name only — never email/cnic/hourlyRate/etc. A visitor deciding
  // between batches reasonably wants to know who teaches it, same
  // "relevant course data" every other batch field here already exposes.
  { path: 'trainer', select: 'user qualification', populate: { path: 'user', select: 'name' } },
];

const serializeBatch = (b) => ({
  _id: b._id,
  batchCode: b.batchCode,
  startDate: b.startDate,
  endDate: b.endDate,
  status: b.status,
  campus: b.campus
    ? { _id: b.campus._id, name: b.campus.name, address: b.campus.address, city: b.campus.city?.name }
    : null,
  slot: b.slot
    ? { _id: b.slot._id, label: b.slot.label, startTime: b.slot.startTime, endTime: b.slot.endTime, days: b.slot.days }
    : null,
  trainer: b.trainer?.user ? { name: b.trainer.user.name, qualification: b.trainer.qualification || undefined } : null,
});

// @desc    List courses currently open for public registration (isActive
//          course with at least one open batch). Never hardcoded — always a
//          live query.
// @route   GET /api/public/courses
// @access  Public
const getPublicCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ isActive: true }).sort({ name: 1 });
  const courseIds = courses.map((c) => c._id);

  const openBatches = await Batch.find({
    course: { $in: courseIds },
    registrationOpen: true,
    status: { $in: OPEN_BATCH_STATUSES },
  }).populate(BATCH_PUBLIC_POPULATE);

  const batchesByCourse = new Map();
  openBatches.forEach((b) => {
    const key = b.course.toString();
    if (!batchesByCourse.has(key)) batchesByCourse.set(key, []);
    batchesByCourse.get(key).push(b);
  });

  const items = courses
    .filter((c) => batchesByCourse.has(c._id.toString()))
    .map((c) => {
      const batches = batchesByCourse.get(c._id.toString());
      const campusNames = [...new Set(batches.map((b) => b.campus?.name).filter(Boolean))];
      return {
        _id: c._id,
        name: c.name,
        code: c.code,
        description: c.description,
        durationInMonths: c.durationInMonths,
        fee: c.fee,
        registrationOpen: true,
        availableBatchesCount: batches.length,
        campuses: campusNames,
      };
    });

  res.json({ success: true, data: items });
});

// @desc    Course details + its currently open batches (with campus/slot),
//          for the public Course Details page. Reachable even for a
//          course/batch combination that isn't currently open, so a deep
//          link can still show "registration closed" instead of a bare 404.
// @route   GET /api/public/courses/:id
// @access  Public
const getPublicCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  const batches = await Batch.find({
    course: course._id,
    registrationOpen: true,
    status: { $in: OPEN_BATCH_STATUSES },
  })
    .populate(BATCH_PUBLIC_POPULATE)
    .sort({ startDate: 1 });

  res.json({
    success: true,
    data: {
      _id: course._id,
      name: course.name,
      code: course.code,
      description: course.description,
      durationInMonths: course.durationInMonths,
      fee: course.fee,
      registrationOpen: course.isActive && batches.length > 0,
      batches: batches.map(serializeBatch),
    },
  });
});

// @desc    Public registration submission. For a brand-new visitor, this
//          creates ONLY a Registration — no User/Student/Enrollment exists
//          yet — left in 'pending' status for Super Admin/Admin to review
//          through the separate Registrations module
//          (registration.controller.js). A User+Student is created only if
//          and when that Registration is approved. For a person who already
//          has a Student account, this instead verifies their password and
//          adds a new Enrollment to that existing account directly (no
//          Registration involved — their identity is already vetted). See
//          Registration.js's header comment for the full architecture.
// @route   POST /api/public/register
// @access  Public
const registerAndEnroll = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    fatherName,
    cnic,
    fatherCnic,
    fatherContactNumber,
    dateOfBirth,
    gender,
    address,
    highestQualification,
    computerProficiency,
    laptopAvailability,
    course: courseId,
    batch: batchId,
  } = req.body;

  // --- Required-field validation (server is the source of truth; the
  // client mirrors this but is never trusted alone). ---
  const required = { name, email, password, phone, fatherName, cnic, dateOfBirth, gender, address, highestQualification };
  const missing = Object.entries(required)
    .filter(([, v]) => !v || !String(v).trim())
    .map(([k]) => k);
  if (missing.length) {
    res.status(400);
    throw new Error(`Missing required field(s): ${missing.join(', ')}`);
  }
  if (!courseId || !batchId) {
    res.status(400);
    throw new Error('Please select a course and a batch');
  }
  // Mandatory for every course registration submission — validated before
  // anything else below runs (account lookup, duplicate checks, ...), same
  // "validate the upload before allowing submission" discipline as the Job
  // Portal's own applicant photo (applicantPortal.controller.js's
  // submitApplication). Completely separate from — never — a course/batch
  // image; this is the registrant's own photo, stored on
  // Registration.profilePicture below and carried over to
  // Student.profilePicture verbatim once/if the registration is approved.
  if (!req.file) {
    res.status(400);
    throw new Error('A profile photo is required to register');
  }

  if (!EMAIL_RE.test(email)) {
    res.status(400);
    throw new Error('Please provide a valid email address');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }
  if (!PHONE_RE.test(phone)) {
    res.status(400);
    throw new Error('Please provide a valid phone number');
  }
  if (fatherContactNumber && !PHONE_RE.test(fatherContactNumber)) {
    res.status(400);
    throw new Error("Please provide a valid father's contact number");
  }
  if (!CNIC_RE.test(cnic)) {
    res.status(400);
    throw new Error('CNIC must be in the format xxxxx-xxxxxxx-x');
  }
  if (fatherCnic && !CNIC_RE.test(fatherCnic)) {
    res.status(400);
    throw new Error("Father's CNIC must be in the format xxxxx-xxxxxxx-x");
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    res.status(400);
    throw new Error('Please provide a valid date of birth');
  }
  if (!GENDERS.includes(gender)) {
    res.status(400);
    throw new Error('Invalid gender selection');
  }
  if (!QUALIFICATIONS.includes(highestQualification)) {
    res.status(400);
    throw new Error('Invalid qualification selection');
  }
  if (computerProficiency && !PROFICIENCIES.includes(computerProficiency)) {
    res.status(400);
    throw new Error('Invalid computer proficiency selection');
  }

  // --- Course/batch/registration-window validation. Never trust a
  // client-supplied campus/slot/trainer — those are always derived from the
  // batch server-side below, so a public caller can't mass-assign them. ---
  const course = await Course.findById(courseId);
  if (!course || !course.isActive) {
    res.status(400);
    throw new Error('Selected course is not available for registration');
  }
  const batch = await Batch.findById(batchId);
  if (!batch || batch.course.toString() !== course._id.toString()) {
    res.status(400);
    throw new Error('Selected batch does not belong to the selected course');
  }
  if (!batch.registrationOpen || !OPEN_BATCH_STATUSES.includes(batch.status)) {
    res.status(400);
    throw new Error('Registration is closed for the selected batch');
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  // --- Duplicate protection. Never silently create a second account, and
  // never let the same identity queue up two pending Registrations under
  // different emails either. ---
  const existingUser = await User.findOne({ email: normalizedEmail });
  const existingStudentByCnic = await Student.findOne({ cnic }).populate('user', 'email role');
  // A Registration for this CNIC that's still awaiting review — same
  // "don't let a second submission race the first" reasoning as the
  // existingStudentByCnic check below, just extended to cover an identity
  // that hasn't been promoted to a Student yet.
  const existingRegistrationByCnic = await Registration.findOne({ cnic, status: 'pending' });

  if (
    existingStudentByCnic &&
    (!existingUser || existingStudentByCnic.user?.email !== normalizedEmail)
  ) {
    res.status(409);
    throw new Error(
      'A student with this CNIC is already registered under a different email. Please log in with your existing account, or contact the institute if you believe this is a mistake.'
    );
  }
  if (existingRegistrationByCnic && existingRegistrationByCnic.email !== normalizedEmail) {
    res.status(409);
    throw new Error(
      'A registration with this CNIC is already pending review under a different email. Please wait for that review, or contact the institute if you believe this is a mistake.'
    );
  }

  // An existing (already-approved) student applying to another course skips
  // Registration entirely — their identity is already vetted, so this only
  // ever creates a new Enrollment for their existing Student account, per
  // the domain rule (never a second Student for the same person). A
  // brand-new visitor, on the other hand, has no Student to attach an
  // Enrollment to yet — see the `else` branch below, which creates a
  // Registration for review instead of an Enrollment.
  if (existingUser) {
    if (existingUser.role !== ROLES.STUDENT) {
      res.status(409);
      throw new Error('This email is already associated with an account. Please use a different email address.');
    }

    // Password is required to prove this is genuinely their account before
    // adding anything to it.
    const authedUser = await User.findById(existingUser._id).select('+password');
    const passwordMatches = await authedUser.comparePassword(password);
    if (!passwordMatches) {
      res.status(409);
      throw new Error(
        'An account with this email already exists. Enter that account’s password to submit another course application, or log in to the Student Portal instead.'
      );
    }

    const student = await Student.findOne({ user: existingUser._id });
    if (!student) {
      res.status(409);
      throw new Error('This email belongs to an existing account that is not a student account.');
    }
    if (student.cnic && student.cnic !== cnic) {
      res.status(409);
      throw new Error('The CNIC provided does not match the CNIC already on file for this account.');
    }

    const existingEnrollment = await Enrollment.findOne({ student: student._id, course: course._id, batch: batch._id });
    if (existingEnrollment) {
      res.status(409);
      throw new Error('You are already enrolled (or have already applied) for this course batch.');
    }

    // Trainer/campus/slot are always copied from the Batch the visitor
    // picked — never accepted directly from the request body — so a public
    // caller can never assign themselves a trainer or campus outside what
    // the batch is actually configured for. Status always starts 'pending';
    // nothing here can mark an admission pre-approved.
    const enrollment = await Enrollment.create({
      student: student._id,
      course: course._id,
      batch: batch._id,
      campus: batch.campus,
      trainer: batch.trainer,
      slot: batch.slot,
      status: 'pending',
      history: [{ status: 'pending', note: 'Submitted via public registration', changedBy: existingUser._id }],
    });

    res.status(201).json({
      success: true,
      data: {
        isNewAccount: false,
        studentId: student._id,
        enrollmentId: enrollment._id,
        status: enrollment.status,
        course: { name: course.name, code: course.code },
        batch: { batchCode: batch.batchCode },
        applicant: { name: existingUser.name, email: existingUser.email },
      },
    });
    return;
  }

  // --- Brand-new visitor: no User/Student/Enrollment is created here. This
  // submission becomes a Registration — reviewed by Super Admin/Admin
  // (registration.controller.js), which is the ONLY place a User+Student
  // ever gets created from this flow (on approval). See Registration.js's
  // header comment for the full reasoning. The password is hashed here
  // (never stored plaintext) and reused as-is if/when a User is eventually
  // created — see User.js's own pre-save hook. ---
  let normalizedLaptopAvailability;
  if (laptopAvailability === 'true' || laptopAvailability === true) normalizedLaptopAvailability = true;
  else if (laptopAvailability === 'false' || laptopAvailability === false) normalizedLaptopAvailability = false;

  let registration;
  try {
    registration = await Registration.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(String(password), 10),
      phone,
      fatherName,
      cnic,
      fatherCnic: fatherCnic || undefined,
      fatherContactNumber: fatherContactNumber || undefined,
      dateOfBirth: dob,
      gender,
      address,
      highestQualification,
      computerProficiency: computerProficiency || undefined,
      laptopAvailability: normalizedLaptopAvailability,
      profilePicture: req.file ? `/uploads/${req.file.filename}` : undefined,
      course: course._id,
      batch: batch._id,
      status: 'pending',
      history: [{ status: 'pending', note: 'Submitted via public registration' }],
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('You have already submitted a registration for this course batch with this email.');
    }
    throw err;
  }

  res.status(201).json({
    success: true,
    data: {
      isNewAccount: true,
      registrationId: registration._id,
      status: registration.status,
      course: { name: course.name, code: course.code },
      batch: { batchCode: batch.batchCode },
      applicant: { name: registration.name, email: registration.email },
    },
  });
});

module.exports = { getPublicCourses, getPublicCourse, registerAndEnroll };
