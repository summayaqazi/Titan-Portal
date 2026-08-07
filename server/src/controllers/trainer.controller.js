const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const Trainer = require('../models/Trainer');
const User = require('../models/User');
const Campus = require('../models/Campus');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Enrollment = require('../models/Enrollment');
const { ROLES } = require('../utils/constants');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { requireAdminCampusScope } = require('../utils/campusScope');

const POPULATE = [
  { path: 'user', select: 'name email phone avatar isActive' },
  { path: 'campuses', select: 'name' },
  { path: 'courses', select: 'name code' },
];

const toArray = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
};

const getTrainers = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (req.query.campus) filter.campuses = req.query.campus;
  if (req.query.course) filter.courses = req.query.course;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  // ADMIN must never see another campus's trainers, even if this page's
  // own (pre-existing, Super-Admin-facing) campus filter above was left
  // unset or tampered with.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope) filter.campuses = campusScope;

  if (search) {
    const matchingUsers = await User.find({
      role: ROLES.TRAINER,
      name: { $regex: search, $options: 'i' },
    }).select('_id');
    filter.user = { $in: matchingUsers.map((u) => u._id) };
  }

  const [items, total] = await Promise.all([
    Trainer.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Trainer.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const getTrainer = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id).populate(POPULATE);
  if (!trainer) {
    res.status(404);
    throw new Error('Trainer not found');
  }
  res.json({ success: true, data: trainer });
});

const validateCampusesAndCourses = async (campuses, courses) => {
  if (campuses?.length) {
    const count = await Campus.countDocuments({ _id: { $in: campuses } });
    if (count !== campuses.length) {
      const error = new Error('One or more selected campuses do not exist');
      error.statusCode = 400;
      throw error;
    }
  }
  if (courses?.length) {
    const count = await Course.countDocuments({ _id: { $in: courses } });
    if (count !== courses.length) {
      const error = new Error('One or more selected courses do not exist');
      error.statusCode = 400;
      throw error;
    }
  }
};

const createTrainer = asyncHandler(async (req, res) => {
  const { name, email, password, phone, qualification, cnic, joiningDate, bio, hourlyRate } = req.body;
  const campuses = toArray(req.body.campuses ?? req.body.campus) || [];
  const specialization = toArray(req.body.specialization) || [];
  const courses = toArray(req.body.courses) || [];
  const socialLinks = {
    linkedin: req.body['socialLinks[linkedin]'] ?? req.body.socialLinks?.linkedin,
    twitter: req.body['socialLinks[twitter]'] ?? req.body.socialLinks?.twitter,
    facebook: req.body['socialLinks[facebook]'] ?? req.body.socialLinks?.facebook,
    website: req.body['socialLinks[website]'] ?? req.body.socialLinks?.website,
  };

  if (!name || !email || campuses.length === 0) {
    res.status(400);
    throw new Error('Name, email and at least one campus are required');
  }

  try {
    await validateCampusesAndCourses(campuses, courses);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    password: password || 'Trainer123',
    role: ROLES.TRAINER,
    phone,
  });

  const trainer = await Trainer.create({
    user: user._id,
    campuses,
    specialization,
    qualification,
    cnic,
    joiningDate,
    bio,
    hourlyRate: hourlyRate || undefined,
    socialLinks,
    courses,
    profileImage: req.file ? `/uploads/${req.file.filename}` : undefined,
  });

  res.status(201).json({ success: true, data: await trainer.populate(POPULATE) });
});

const updateTrainer = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    res.status(404);
    throw new Error('Trainer not found');
  }

  const { name, email, phone, isActive: userActive, qualification, cnic, joiningDate, isActive, bio, hourlyRate } =
    req.body;
  const campuses = toArray(req.body.campuses ?? req.body.campus);
  const specialization = toArray(req.body.specialization);
  const courses = toArray(req.body.courses);
  const hasSocialLinks =
    req.body.socialLinks !== undefined ||
    ['linkedin', 'twitter', 'facebook', 'website'].some((k) => req.body[`socialLinks[${k}]`] !== undefined);

  const user = await User.findById(trainer.user);
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

  if (campuses !== undefined) {
    if (campuses.length === 0) {
      res.status(400);
      throw new Error('At least one campus is required');
    }
    await validateCampusesAndCourses(campuses, courses).catch((err) => {
      res.status(err.statusCode || 400);
      throw err;
    });
    trainer.campuses = campuses;
  }
  if (courses !== undefined) trainer.courses = courses;
  if (specialization !== undefined) trainer.specialization = specialization;
  if (qualification !== undefined) trainer.qualification = qualification;
  if (cnic !== undefined) trainer.cnic = cnic;
  if (joiningDate !== undefined) trainer.joiningDate = joiningDate;
  if (isActive !== undefined) trainer.isActive = isActive;
  if (bio !== undefined) trainer.bio = bio;
  if (hourlyRate !== undefined) trainer.hourlyRate = hourlyRate || undefined;
  if (hasSocialLinks) {
    trainer.socialLinks = {
      linkedin: req.body['socialLinks[linkedin]'] ?? req.body.socialLinks?.linkedin ?? trainer.socialLinks?.linkedin,
      twitter: req.body['socialLinks[twitter]'] ?? req.body.socialLinks?.twitter ?? trainer.socialLinks?.twitter,
      facebook: req.body['socialLinks[facebook]'] ?? req.body.socialLinks?.facebook ?? trainer.socialLinks?.facebook,
      website: req.body['socialLinks[website]'] ?? req.body.socialLinks?.website ?? trainer.socialLinks?.website,
    };
  }

  if (req.file) {
    if (trainer.profileImage) {
      const oldPath = path.join(__dirname, '..', trainer.profileImage.replace('/uploads/', 'uploads/'));
      fs.unlink(oldPath, () => {});
    }
    trainer.profileImage = `/uploads/${req.file.filename}`;
  } else if (req.body.removeProfileImage === 'true' && trainer.profileImage) {
    const oldPath = path.join(__dirname, '..', trainer.profileImage.replace('/uploads/', 'uploads/'));
    fs.unlink(oldPath, () => {});
    trainer.profileImage = undefined;
  }

  await trainer.save();
  res.json({ success: true, data: await trainer.populate(POPULATE) });
});

const deleteTrainer = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    res.status(404);
    throw new Error('Trainer not found');
  }

  const [batchCount, enrollmentCount] = await Promise.all([
    Batch.countDocuments({ trainer: trainer._id }),
    Enrollment.countDocuments({ trainer: trainer._id }),
  ]);
  if (batchCount > 0 || enrollmentCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a trainer assigned to batches or enrollments');
  }

  await trainer.deleteOne();
  await User.findByIdAndDelete(trainer.user);
  res.json({ success: true, message: 'Trainer deleted' });
});

module.exports = { getTrainers, getTrainer, createTrainer, updateTrainer, deleteTrainer };
