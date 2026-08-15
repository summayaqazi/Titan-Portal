const asyncHandler = require('express-async-handler');
const Registration = require('../models/Registration');
const User = require('../models/User');
const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { REGISTRATION_STATUSES, ROLES } = require('../utils/constants');
const { scopeBatchFilterToCampus, requireAdminCampusScope } = require('../utils/campusScope');

// Super Admin (+ campus-scoped Admin) Registration review. Parallel to
// application.controller.js's own review workflow for the Job Portal, but
// over the Registration collection instead of Application — see
// Registration.js's header comment for why these two are deliberately
// separate collections/pages/permissions from Students/Enrollment.

const POPULATE = [
  { path: 'course', select: 'name code fee durationInMonths' },
  { path: 'batch', select: 'batchCode campus', populate: { path: 'campus', select: 'name' } },
  { path: 'reviewedBy', select: 'name' },
  { path: 'student', select: 'user' },
];

const serializeRegistration = (registration) => ({
  _id: registration._id,
  status: registration.status,
  createdAt: registration.createdAt,
  name: registration.name,
  email: registration.email,
  phone: registration.phone,
  fatherName: registration.fatherName,
  cnic: registration.cnic,
  fatherCnic: registration.fatherCnic,
  fatherContactNumber: registration.fatherContactNumber,
  dateOfBirth: registration.dateOfBirth,
  gender: registration.gender,
  address: registration.address,
  highestQualification: registration.highestQualification,
  computerProficiency: registration.computerProficiency,
  laptopAvailability: registration.laptopAvailability,
  // The applicant's own submitted photo — same field/convention as
  // Student.profilePicture (copied there verbatim on approval), distinct
  // from any course/batch imagery.
  profilePicture: registration.profilePicture || null,
  course: registration.course
    ? { _id: registration.course._id, name: registration.course.name, code: registration.course.code, fee: registration.course.fee }
    : null,
  batch: registration.batch
    ? { _id: registration.batch._id, batchCode: registration.batch.batchCode, campus: registration.batch.campus?.name }
    : null,
  history: (registration.history || []).map((h) => ({ status: h.status, note: h.note, changedAt: h.changedAt })),
  reviewedBy: registration.reviewedBy?.name || null,
  reviewedAt: registration.reviewedAt || null,
  // Only ever set once approved — lets the UI link straight to the
  // resulting Student record without guessing.
  studentId: registration.student?._id || registration.student || null,
  // Logged automatically by logRegistrationVisit below, every time the
  // EXISTING "Review" click opens this registration — see
  // Registration.js's registrationVisitSchema comment. Never a separate
  // Visitor button/page; this is just what the detail drawer displays.
  visitCount: registration.visits?.length || 0,
  lastVisitedAt: registration.visits?.length ? registration.visits[registration.visits.length - 1].visitedAt : null,
});

// Shared by getRegistrations and (later, if ever needed) an export — same
// "one filter builder, reused everywhere it's needed" convention
// student.controller.js's own buildStudentFilter already uses.
const buildRegistrationFilter = async (req) => {
  const filter = {};
  if (req.query.status && REGISTRATION_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.course) filter.course = req.query.course;
  if (req.query.batch) filter.batch = req.query.batch;

  // Admin only ever sees registrations for batches at their own campus —
  // same campus-scoping discipline as every other Admin-reachable list in
  // this app (buildStudentFilter, job.controller.js's getAdminJobScope).
  // undefined for every other role, so Super Admin is unaffected.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope) {
    filter.batch = await scopeBatchFilterToCampus(campusScope, filter.batch);
  }

  const search = (req.query.search || '').trim();
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { cnic: { $regex: search, $options: 'i' } },
    ];
  }

  return filter;
};

// @desc    List every registration in the system (or, for Admin, every
//          registration for their own campus's batches). Paginated,
//          filterable by status/course/batch/search.
// @route   GET /api/registrations
// @access  Private (SUPER_ADMIN, ADMIN — 'registrations' view permission)
const getRegistrations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseListQuery(req);
  const filter = await buildRegistrationFilter(req);

  const [registrations, total] = await Promise.all([
    Registration.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Registration.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items: registrations.map(serializeRegistration), total, page, limit }));
});

// @desc    Single registration's full detail for review.
// @route   GET /api/registrations/:id
// @access  Private (SUPER_ADMIN, ADMIN — 'registrations' view permission)
const getRegistration = asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id).populate(POPULATE);
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  // Admin can only open a registration for their own campus's batch — same
  // ownership discipline as the list above, enforced again here so a direct
  // GET /:id can't bypass it.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope && registration.batch?.campus?._id?.toString() !== campusScope.toString()) {
    res.status(404);
    throw new Error('Registration not found');
  }

  res.json({ success: true, data: serializeRegistration(registration) });
});

// @desc    Approve or reject a registration.
//          - Reject: just records the decision. No Student is ever created.
//          - Approve: THE promotion — creates the User + Student +
//            Enrollment this registration described, exactly once (guarded
//            by `registration.student`, so re-approving an already-approved
//            registration is rejected outright rather than silently
//            creating a duplicate Student). This is the one and only place
//            in the app a Student gets created from a public registration —
//            see Registration.js's header comment.
// @route   PUT /api/registrations/:id
// @access  Private (SUPER_ADMIN, ADMIN — 'registrations' update permission)
const updateRegistrationStatus = asyncHandler(async (req, res) => {
  // select('+passwordHash') — needed only on the approve path below, never
  // serialized back to the client (serializeRegistration never reads it).
  const registration = await Registration.findById(req.params.id).select('+passwordHash').populate('batch');
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  const campusScope = requireAdminCampusScope(req);
  if (campusScope && registration.batch?.campus?.toString() !== campusScope.toString()) {
    res.status(404);
    throw new Error('Registration not found');
  }

  const { status, note } = req.body;
  if (!status || !REGISTRATION_STATUSES.includes(status) || status === 'pending') {
    res.status(400);
    throw new Error('A valid status (approved or rejected) is required');
  }

  if (status === registration.status) {
    const populated = await registration.populate(POPULATE);
    res.json({ success: true, data: serializeRegistration(populated) });
    return;
  }

  if (registration.status !== 'pending') {
    res.status(400);
    throw new Error(`This registration was already ${registration.status} and cannot be changed`);
  }

  if (status === 'approved') {
    // Explicit duplicate-Student guard, on top of (not instead of) the
    // status-machine check above (registration.status !== 'pending' already
    // blocks re-approving in the normal sequential case — this is a second,
    // independent line of defense, cheap to check, in case that guard is
    // ever loosened by a future change). If a Student is already linked,
    // never create a second one for the same registration.
    if (registration.student) {
      res.status(409);
      throw new Error('This registration is already linked to a Student and cannot be approved again.');
    }

    // Re-checked here (not just at submission time) — enough time may have
    // passed since submission that the email/CNIC now collides with an
    // account created in the meantime, by this same registration's own
    // approval or an unrelated one. Never silently proceed into a duplicate.
    const [existingUser, existingStudentByCnic] = await Promise.all([
      User.findOne({ email: registration.email }),
      registration.cnic ? Student.findOne({ cnic: registration.cnic }) : null,
    ]);
    if (existingUser) {
      res.status(409);
      throw new Error('An account with this email already exists. Reject this registration instead if it is a duplicate.');
    }
    if (existingStudentByCnic) {
      res.status(409);
      throw new Error('A student with this CNIC is already registered. Reject this registration instead if it is a duplicate.');
    }

    const user = await User.create({
      name: registration.name,
      email: registration.email,
      // Already bcrypt-hashed at submission time — User.js's pre-save hook
      // recognizes the hash format and passes it through unchanged rather
      // than hashing it a second time.
      password: registration.passwordHash,
      role: ROLES.STUDENT,
      phone: registration.phone,
    });

    let normalizedLaptopAvailability;
    if (registration.laptopAvailability === true || registration.laptopAvailability === false) {
      normalizedLaptopAvailability = registration.laptopAvailability;
    }

    const student = await Student.create({
      user: user._id,
      fatherName: registration.fatherName,
      cnic: registration.cnic,
      fatherCnic: registration.fatherCnic || undefined,
      fatherContactNumber: registration.fatherContactNumber || undefined,
      dateOfBirth: registration.dateOfBirth,
      gender: registration.gender,
      address: registration.address,
      highestQualification: registration.highestQualification,
      computerProficiency: registration.computerProficiency || undefined,
      laptopAvailability: normalizedLaptopAvailability,
      profilePicture: registration.profilePicture,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    // Same derivation as enrollment.controller.js's own createEnrollment —
    // campus/trainer/slot always copied from the Batch, never re-entered.
    await Enrollment.create({
      student: student._id,
      course: registration.course,
      batch: registration.batch._id,
      campus: registration.batch.campus,
      trainer: registration.batch.trainer,
      slot: registration.batch.slot,
      status: 'pending',
      history: [{ status: 'pending', note: 'Enrollment created from an approved registration', changedBy: req.user._id }],
    });

    registration.student = student._id;
    registration.reviewedBy = req.user._id;
    registration.reviewedAt = new Date();
  } else {
    registration.reviewedBy = req.user._id;
    registration.reviewedAt = new Date();
  }

  registration.status = status;
  registration.history.push({ status, note, changedBy: req.user._id });
  await registration.save();

  const populated = await registration.populate(POPULATE);
  res.json({ success: true, data: serializeRegistration(populated) });
});

// @desc    Logs a "visit" — staff opening this registration to review it.
//          This is the Visitor API's entire surface: no separate Visitor
//          page/button/route exists anywhere in the app. The frontend calls
//          this automatically, in the background, the moment the EXISTING
//          "Review" action (Registrations.jsx's row click / detail drawer
//          open) shows a registration's detail — never from a dedicated
//          Visitor control of any kind. Gated on the same 'view' permission
//          as actually reading the registration, since logging a visit is a
//          byproduct of viewing it, not a separate elevated action.
// @route   POST /api/registrations/:id/visit
// @access  Private (SUPER_ADMIN, ADMIN — 'registrations' view permission)
const logRegistrationVisit = asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id).populate('batch', 'campus');
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  // Same ownership discipline as getRegistration/updateRegistrationStatus
  // above — an Admin can only log a visit against their own campus's
  // registrations.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope && registration.batch?.campus?.toString() !== campusScope.toString()) {
    res.status(404);
    throw new Error('Registration not found');
  }

  registration.visits.push({ visitedBy: req.user._id, visitedAt: new Date() });
  await registration.save();

  res.json({
    success: true,
    data: {
      visitCount: registration.visits.length,
      lastVisitedAt: registration.visits[registration.visits.length - 1].visitedAt,
    },
  });
});

module.exports = { getRegistrations, getRegistration, updateRegistrationStatus, logRegistrationVisit };
