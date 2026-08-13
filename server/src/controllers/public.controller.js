const asyncHandler = require('express-async-handler');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
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

// @desc    Public registration + enrollment submission. Creates User +
//          Student + Enrollment (or, for a person who already has a
//          Student account, verifies their password and only adds a new
//          Enrollment to that existing account) and leaves the resulting
//          enrollment in 'pending' status for Admin/Super Admin to review
//          through their existing workflows.
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

  // --- Duplicate protection. Never silently create a second account. ---
  const existingUser = await User.findOne({ email: normalizedEmail });
  const existingStudentByCnic = await Student.findOne({ cnic }).populate('user', 'email role');

  if (
    existingStudentByCnic &&
    (!existingUser || existingStudentByCnic.user?.email !== normalizedEmail)
  ) {
    res.status(409);
    throw new Error(
      'A student with this CNIC is already registered under a different email. Please log in with your existing account, or contact the institute if you believe this is a mistake.'
    );
  }

  let user;
  let student;
  let isNewAccount = false;

  if (existingUser) {
    if (existingUser.role !== ROLES.STUDENT) {
      res.status(409);
      throw new Error('This email is already associated with an account. Please use a different email address.');
    }

    // An existing student applying to another course: use the existing
    // Student account and only create a new Enrollment for it, per the
    // domain rule (never a second Student for the same person). Password
    // is required to prove this is genuinely their account before adding
    // anything to it.
    const authedUser = await User.findById(existingUser._id).select('+password');
    const passwordMatches = await authedUser.comparePassword(password);
    if (!passwordMatches) {
      res.status(409);
      throw new Error(
        'An account with this email already exists. Enter that account’s password to submit another course application, or log in to the Student Portal instead.'
      );
    }

    student = await Student.findOne({ user: existingUser._id });
    if (!student) {
      res.status(409);
      throw new Error('This email belongs to an existing account that is not a student account.');
    }
    if (student.cnic && student.cnic !== cnic) {
      res.status(409);
      throw new Error('The CNIC provided does not match the CNIC already on file for this account.');
    }

    user = existingUser;
  } else {
    isNewAccount = true;
  }

  // --- Duplicate enrollment protection (friendly pre-check; the schema's
  // {student, course, batch} unique index is still the final guard under
  // concurrent requests, translated into the same message by
  // error.middleware.js). ---
  if (student) {
    const existingEnrollment = await Enrollment.findOne({ student: student._id, course: course._id, batch: batch._id });
    if (existingEnrollment) {
      res.status(409);
      throw new Error('You are already enrolled (or have already applied) for this course batch.');
    }
  }

  if (isNewAccount) {
    user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      role: ROLES.STUDENT,
      phone,
    });

    let normalizedLaptopAvailability;
    if (laptopAvailability === 'true' || laptopAvailability === true) normalizedLaptopAvailability = true;
    else if (laptopAvailability === 'false' || laptopAvailability === false) normalizedLaptopAvailability = false;

    student = await Student.create({
      user: user._id,
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
    });
  }

  // Trainer/campus/slot are always copied from the Batch the visitor picked
  // — never accepted directly from the request body — so a public caller
  // can never assign themselves a trainer or campus outside what the batch
  // is actually configured for. Status always starts 'pending'; nothing
  // here can mark an application pre-approved.
  const enrollment = await Enrollment.create({
    student: student._id,
    course: course._id,
    batch: batch._id,
    campus: batch.campus,
    trainer: batch.trainer,
    slot: batch.slot,
    status: 'pending',
    history: [{ status: 'pending', note: 'Submitted via public registration', changedBy: user._id }],
  });

  res.status(201).json({
    success: true,
    data: {
      isNewAccount,
      studentId: student._id,
      enrollmentId: enrollment._id,
      status: enrollment.status,
      course: { name: course.name, code: course.code },
      batch: { batchCode: batch.batchCode },
      applicant: { name: user.name, email: user.email },
    },
  });
});

module.exports = { getPublicCourses, getPublicCourse, registerAndEnroll };
