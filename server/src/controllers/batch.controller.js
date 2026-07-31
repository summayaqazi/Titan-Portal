const asyncHandler = require('express-async-handler');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Campus = require('../models/Campus');
const Trainer = require('../models/Trainer');
const Slot = require('../models/Slot');
const Enrollment = require('../models/Enrollment');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const POPULATE = [
  { path: 'course', select: 'name code' },
  { path: 'campus', select: 'name' },
  { path: 'trainer', populate: { path: 'user', select: 'name' } },
  { path: 'slot', select: 'label startTime endTime' },
];

const getBatches = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (search) filter.batchCode = { $regex: search, $options: 'i' };
  if (req.query.course) filter.course = req.query.course;
  if (req.query.campus) filter.campus = req.query.campus;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.registrationOpen !== undefined) {
    filter.registrationOpen = req.query.registrationOpen === 'true';
  }

  const [items, total] = await Promise.all([
    Batch.find(filter).populate(POPULATE).sort({ startDate: -1 }).skip(skip).limit(limit),
    Batch.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const getBatch = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id).populate(POPULATE);
  if (!batch) {
    res.status(404);
    throw new Error('Batch not found');
  }
  res.json({ success: true, data: batch });
});

const validateRefs = async ({ course, campus, trainer, slot }) => {
  if (course) {
    const exists = await Course.findById(course);
    if (!exists) return 'Selected course does not exist';
  }
  if (campus) {
    const exists = await Campus.findById(campus);
    if (!exists) return 'Selected campus does not exist';
  }
  if (trainer) {
    const exists = await Trainer.findById(trainer);
    if (!exists) return 'Selected trainer does not exist';
  }
  if (slot) {
    const exists = await Slot.findById(slot);
    if (!exists) return 'Selected slot does not exist';
  }
  return null;
};

const createBatch = asyncHandler(async (req, res) => {
  const { batchCode, course, campus, trainer, slot, startDate, endDate, capacity, status, registrationOpen } =
    req.body;

  if (!batchCode || !course || !campus || !startDate) {
    res.status(400);
    throw new Error('Batch code, course, campus and start date are required');
  }

  const existing = await Batch.findOne({ batchCode });
  if (existing) {
    res.status(400);
    throw new Error('A batch with this code already exists');
  }

  const refError = await validateRefs({ course, campus, trainer, slot });
  if (refError) {
    res.status(400);
    throw new Error(refError);
  }

  const batch = await Batch.create({
    batchCode,
    course,
    campus,
    trainer: trainer || undefined,
    slot: slot || undefined,
    startDate,
    endDate,
    capacity,
    status,
    registrationOpen,
  });

  res.status(201).json({ success: true, data: await batch.populate(POPULATE) });
});

const updateBatch = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) {
    res.status(404);
    throw new Error('Batch not found');
  }

  const { batchCode, course, campus, trainer, slot, startDate, endDate, capacity, status, registrationOpen } =
    req.body;

  if (batchCode !== undefined && batchCode !== batch.batchCode) {
    const existing = await Batch.findOne({ batchCode });
    if (existing) {
      res.status(400);
      throw new Error('A batch with this code already exists');
    }
    batch.batchCode = batchCode;
  }

  const refError = await validateRefs({ course, campus, trainer, slot });
  if (refError) {
    res.status(400);
    throw new Error(refError);
  }

  if (course !== undefined) batch.course = course;
  if (campus !== undefined) batch.campus = campus;
  if (trainer !== undefined) batch.trainer = trainer || undefined;
  if (slot !== undefined) batch.slot = slot || undefined;
  if (startDate !== undefined) batch.startDate = startDate;
  if (endDate !== undefined) batch.endDate = endDate;
  if (capacity !== undefined) batch.capacity = capacity;
  if (status !== undefined) batch.status = status;
  if (registrationOpen !== undefined) batch.registrationOpen = registrationOpen;

  await batch.save();
  res.json({ success: true, data: await batch.populate(POPULATE) });
});

const deleteBatch = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) {
    res.status(404);
    throw new Error('Batch not found');
  }

  const enrollmentCount = await Enrollment.countDocuments({ batch: batch._id });
  if (enrollmentCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a batch that has student enrollments');
  }

  await batch.deleteOne();
  res.json({ success: true, message: 'Batch deleted' });
});

module.exports = { getBatches, getBatch, createBatch, updateBatch, deleteBatch };
