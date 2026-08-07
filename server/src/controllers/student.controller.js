const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Student = require('../models/Student');
const User = require('../models/User');
const City = require('../models/City');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const { ROLES } = require('../utils/constants');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { studentAuditPdf } = require('../utils/pdfGenerator');
const { sendCsv } = require('../utils/csvExport');
const { requireAdminCampusScope } = require('../utils/campusScope');

const CNIC_RE = /^\d{5}-\d{7}-\d$/;

const POPULATE = [
  { path: 'user', select: 'name email phone avatar isActive lastLogin' },
  { path: 'city', select: 'name' },
  { path: 'createdBy', select: 'name' },
  { path: 'updatedBy', select: 'name' },
  { path: 'cnicVerifiedBy', select: 'name' },
];

// Shared by getStudents (paginated) and exportStudents (full CSV) so the
// export always reflects the same filters currently applied on the page.
const buildStudentFilter = async (req) => {
  const filter = {};
  if (req.query.city) filter.city = req.query.city;
  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    filter.isActive = req.query.isActive === 'true';
  }
  if (req.query.cnicVerified !== undefined && req.query.cnicVerified !== '') {
    filter.cnicVerified = req.query.cnicVerified === 'true';
  }

  // A student has no direct campus field — it's derived from their
  // enrollments. `enrollmentStatus` and the campus scope both narrow via
  // Enrollment, so intersect them when both apply rather than letting one
  // overwrite the other. `requireAdminCampusScope` always returns a value
  // for ADMIN (the Admin Portal's Campus Selector, or a sentinel that
  // matches nothing) so this endpoint can never return another campus's
  // students even if the client fails to send one; undefined for every
  // other role, so Super Admin is unaffected.
  const campusScope = requireAdminCampusScope(req);
  if (req.query.enrollmentStatus || campusScope) {
    const enrollmentFilter = {};
    if (req.query.enrollmentStatus) enrollmentFilter.status = req.query.enrollmentStatus;
    if (campusScope) enrollmentFilter.campus = campusScope;
    const studentIds = await Enrollment.find(enrollmentFilter).distinct('student');
    filter._id = { $in: studentIds };
  }

  const search = (req.query.search || '').trim();
  if (search) {
    const matchingUsers = await User.find({
      role: ROLES.STUDENT,
      $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }],
    }).select('_id');
    filter.user = { $in: matchingUsers.map((u) => u._id) };
  }

  return filter;
};

// Attaches each student's "active" enrollment (preferring a currently
// enrolled one, else the most recently admitted) so the list table can show
// course/batch/trainer/enrollment-status/payment-status without a per-row
// round trip.
const attachActiveEnrollments = async (students) => {
  const studentIds = students.map((s) => s._id);
  const enrollments = await Enrollment.find({ student: { $in: studentIds } })
    .populate('course', 'name')
    .populate('batch', 'batchCode')
    .populate({ path: 'trainer', populate: { path: 'user', select: 'name' } })
    .sort({ admissionDate: -1 });

  enrollments.sort((a, b) => {
    const enrolledDiff = (b.status === 'enrolled') - (a.status === 'enrolled');
    if (enrolledDiff !== 0) return enrolledDiff;
    return new Date(b.admissionDate) - new Date(a.admissionDate);
  });

  const byStudent = new Map();
  enrollments.forEach((e) => {
    const key = e.student.toString();
    if (!byStudent.has(key)) byStudent.set(key, e);
  });

  return students.map((s) => ({ ...s.toObject(), activeEnrollment: byStudent.get(s._id.toString()) || null }));
};

const getStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseListQuery(req);
  const filter = await buildStudentFilter(req);

  const [students, total] = await Promise.all([
    Student.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);

  const items = await attachActiveEnrollments(students);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate(POPULATE);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const enrollments = await Enrollment.find({ student: student._id })
    .populate('course', 'name code')
    .populate('batch', 'batchCode')
    .populate('campus', 'name')
    .populate({ path: 'trainer', populate: { path: 'user', select: 'name' } })
    .populate('slot', 'label')
    .sort({ admissionDate: -1 });

  res.json({ success: true, data: { ...student.toObject(), enrollments } });
});

const createStudent = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    fatherName,
    cnic,
    dateOfBirth,
    gender,
    address,
    city,
    employmentStatus,
    organization,
    designation,
    monthlyIncome,
    highestQualification,
    institute,
    yearOfCompletion,
  } = req.body;

  if (!name || !email) {
    res.status(400);
    throw new Error('Name and email are required');
  }

  if (cnic && !CNIC_RE.test(cnic)) {
    res.status(400);
    throw new Error('CNIC must be in the format xxxxx-xxxxxxx-x');
  }

  if (city) {
    const cityExists = await City.findById(city);
    if (!cityExists) {
      res.status(400);
      throw new Error('Selected city does not exist');
    }
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    password: password || 'Student123',
    role: ROLES.STUDENT,
    phone,
  });

  const student = await Student.create({
    user: user._id,
    fatherName,
    cnic,
    dateOfBirth,
    gender,
    address,
    city: city || undefined,
    profilePicture: req.file ? `/uploads/${req.file.filename}` : undefined,
    employmentStatus: employmentStatus || undefined,
    organization,
    designation,
    monthlyIncome: monthlyIncome || undefined,
    highestQualification: highestQualification || undefined,
    institute,
    yearOfCompletion: yearOfCompletion || undefined,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: await student.populate(POPULATE) });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const {
    name,
    email,
    phone,
    isActive: userActive,
    fatherName,
    cnic,
    dateOfBirth,
    gender,
    address,
    city,
    isActive,
    employmentStatus,
    organization,
    designation,
    monthlyIncome,
    highestQualification,
    institute,
    yearOfCompletion,
  } = req.body;

  if (cnic !== undefined && cnic && !CNIC_RE.test(cnic)) {
    res.status(400);
    throw new Error('CNIC must be in the format xxxxx-xxxxxxx-x');
  }

  const user = await User.findById(student.user);
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (userActive !== undefined) user.isActive = userActive;
  if (email !== undefined && email !== user.email) {
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400);
      throw new Error('A user with this email already exists');
    }
    user.email = email;
  }
  await user.save();

  if (city !== undefined) {
    if (city) {
      const cityExists = await City.findById(city);
      if (!cityExists) {
        res.status(400);
        throw new Error('Selected city does not exist');
      }
    }
    student.city = city || undefined;
  }
  if (fatherName !== undefined) student.fatherName = fatherName;
  if (cnic !== undefined && cnic !== student.cnic) {
    student.cnic = cnic;
    // Re-verification is required whenever the CNIC value itself changes.
    student.cnicVerified = false;
    student.cnicVerifiedAt = undefined;
    student.cnicVerifiedBy = undefined;
  }
  if (dateOfBirth !== undefined) student.dateOfBirth = dateOfBirth;
  if (gender !== undefined) student.gender = gender;
  if (address !== undefined) student.address = address;
  if (isActive !== undefined) student.isActive = isActive;
  if (employmentStatus !== undefined) student.employmentStatus = employmentStatus || undefined;
  if (organization !== undefined) student.organization = organization;
  if (designation !== undefined) student.designation = designation;
  if (monthlyIncome !== undefined) student.monthlyIncome = monthlyIncome || undefined;
  if (highestQualification !== undefined) student.highestQualification = highestQualification || undefined;
  if (institute !== undefined) student.institute = institute;
  if (yearOfCompletion !== undefined) student.yearOfCompletion = yearOfCompletion || undefined;
  student.updatedBy = req.user._id;

  if (req.file) {
    if (student.profilePicture) {
      const oldPath = path.join(__dirname, '..', student.profilePicture.replace('/uploads/', 'uploads/'));
      fs.unlink(oldPath, () => {});
    }
    student.profilePicture = `/uploads/${req.file.filename}`;
  } else if (req.body.removeProfilePicture === 'true' && student.profilePicture) {
    const oldPath = path.join(__dirname, '..', student.profilePicture.replace('/uploads/', 'uploads/'));
    fs.unlink(oldPath, () => {});
    student.profilePicture = undefined;
  }

  await student.save();
  res.json({ success: true, data: await student.populate(POPULATE) });
});

const verifyCnic = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  if (!student.cnic || !CNIC_RE.test(student.cnic)) {
    res.status(400);
    throw new Error('Student does not have a validly formatted CNIC on file');
  }

  student.cnicVerified = true;
  student.cnicVerifiedAt = new Date();
  student.cnicVerifiedBy = req.user._id;
  await student.save();

  res.json({ success: true, data: await student.populate(POPULATE) });
});

const getStudentAuditPdf = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate(POPULATE);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const enrollments = await Enrollment.find({ student: student._id })
    .populate('course', 'name code')
    .populate('batch', 'batchCode')
    .sort({ admissionDate: -1 });

  const payments = await Payment.find({ student: student._id }).sort({ createdAt: -1 });

  studentAuditPdf(res, { student, enrollments, payments });
});

const exportStudents = asyncHandler(async (req, res) => {
  const filter = await buildStudentFilter(req);
  const students = await Student.find(filter).populate(POPULATE).sort({ createdAt: -1 });

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'fatherName', header: "Father's Name" },
    { key: 'cnic', header: 'CNIC' },
    { key: 'cnicVerified', header: 'CNIC Verified' },
    { key: 'city', header: 'City' },
    { key: 'employmentStatus', header: 'Employment Status' },
    { key: 'highestQualification', header: 'Highest Qualification' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Created At' },
  ];

  const rows = students.map((s) => ({
    name: s.user?.name,
    email: s.user?.email,
    phone: s.user?.phone,
    fatherName: s.fatherName,
    cnic: s.cnic,
    cnicVerified: s.cnicVerified ? 'Yes' : 'No',
    city: s.city?.name,
    employmentStatus: s.employmentStatus,
    highestQualification: s.highestQualification,
    status: s.isActive ? 'Active' : 'Inactive',
    createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
  }));

  sendCsv(res, `students-export-${Date.now()}.csv`, columns, rows);
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const enrollmentCount = await Enrollment.countDocuments({ student: student._id });
  if (enrollmentCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a student with existing enrollments');
  }

  await student.deleteOne();
  await User.findByIdAndDelete(student.user);
  res.json({ success: true, message: 'Student deleted' });
});

module.exports = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  verifyCnic,
  getStudentAuditPdf,
  exportStudents,
};
