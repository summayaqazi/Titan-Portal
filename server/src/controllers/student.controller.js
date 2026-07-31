const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Student = require('../models/Student');
const User = require('../models/User');
const City = require('../models/City');
const Enrollment = require('../models/Enrollment');
const { ROLES } = require('../utils/constants');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const POPULATE = [
  { path: 'user', select: 'name email phone avatar isActive lastLogin' },
  { path: 'city', select: 'name' },
];

const getStudents = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (req.query.city) filter.city = req.query.city;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  if (search) {
    const matchingUsers = await User.find({
      role: ROLES.STUDENT,
      $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }],
    }).select('_id');
    filter.user = { $in: matchingUsers.map((u) => u._id) };
  }

  const [items, total] = await Promise.all([
    Student.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);

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
  const { name, email, password, phone, fatherName, cnic, dateOfBirth, gender, address, city } = req.body;

  if (!name || !email) {
    res.status(400);
    throw new Error('Name and email are required');
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
  });

  res.status(201).json({ success: true, data: await student.populate(POPULATE) });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const { name, email, phone, isActive: userActive, fatherName, cnic, dateOfBirth, gender, address, city, isActive } =
    req.body;

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
  if (cnic !== undefined) student.cnic = cnic;
  if (dateOfBirth !== undefined) student.dateOfBirth = dateOfBirth;
  if (gender !== undefined) student.gender = gender;
  if (address !== undefined) student.address = address;
  if (isActive !== undefined) student.isActive = isActive;

  if (req.file) {
    if (student.profilePicture) {
      const oldPath = path.join(__dirname, '..', student.profilePicture.replace('/uploads/', 'uploads/'));
      fs.unlink(oldPath, () => {});
    }
    student.profilePicture = `/uploads/${req.file.filename}`;
  }

  await student.save();
  res.json({ success: true, data: await student.populate(POPULATE) });
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

module.exports = { getStudents, getStudent, createStudent, updateStudent, deleteStudent };
