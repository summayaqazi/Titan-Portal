const asyncHandler = require('express-async-handler');
const Trainer = require('../models/Trainer');
const User = require('../models/User');
const Campus = require('../models/Campus');
const Batch = require('../models/Batch');
const Enrollment = require('../models/Enrollment');
const { ROLES } = require('../utils/constants');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const POPULATE = [
  { path: 'user', select: 'name email phone avatar isActive' },
  { path: 'campus', select: 'name' },
];

const getTrainers = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (req.query.campus) filter.campus = req.query.campus;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  let userIdFilter;
  if (search) {
    const matchingUsers = await User.find({
      role: ROLES.TRAINER,
      name: { $regex: search, $options: 'i' },
    }).select('_id');
    userIdFilter = matchingUsers.map((u) => u._id);
    filter.user = { $in: userIdFilter };
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

const createTrainer = asyncHandler(async (req, res) => {
  const { name, email, password, phone, campus, specialization, qualification, cnic, joiningDate } = req.body;

  if (!name || !email || !campus) {
    res.status(400);
    throw new Error('Name, email and campus are required');
  }

  const campusExists = await Campus.findById(campus);
  if (!campusExists) {
    res.status(400);
    throw new Error('Selected campus does not exist');
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
    campus,
    specialization: Array.isArray(specialization) ? specialization : specialization ? [specialization] : [],
    qualification,
    cnic,
    joiningDate,
  });

  res.status(201).json({ success: true, data: await trainer.populate(POPULATE) });
});

const updateTrainer = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    res.status(404);
    throw new Error('Trainer not found');
  }

  const { name, email, phone, isActive: userActive, campus, specialization, qualification, cnic, joiningDate, isActive } =
    req.body;

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

  if (campus !== undefined) {
    const campusExists = await Campus.findById(campus);
    if (!campusExists) {
      res.status(400);
      throw new Error('Selected campus does not exist');
    }
    trainer.campus = campus;
  }
  if (specialization !== undefined) {
    trainer.specialization = Array.isArray(specialization) ? specialization : [specialization];
  }
  if (qualification !== undefined) trainer.qualification = qualification;
  if (cnic !== undefined) trainer.cnic = cnic;
  if (joiningDate !== undefined) trainer.joiningDate = joiningDate;
  if (isActive !== undefined) trainer.isActive = isActive;

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
