const asyncHandler = require('express-async-handler');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const getCourses = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const [items, total] = await Promise.all([
    Course.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Course.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }
  res.json({ success: true, data: course });
});

const createCourse = asyncHandler(async (req, res) => {
  const { name, code, description, durationInMonths, fee, isActive } = req.body;

  if (!name || !code || !durationInMonths) {
    res.status(400);
    throw new Error('Name, code and duration are required');
  }

  const existing = await Course.findOne({ code: code.toUpperCase() });
  if (existing) {
    res.status(400);
    throw new Error('A course with this code already exists');
  }

  const course = await Course.create({ name, code, description, durationInMonths, fee, isActive });
  res.status(201).json({ success: true, data: course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  const { name, code, description, durationInMonths, fee, isActive } = req.body;

  if (code !== undefined && code.toUpperCase() !== course.code) {
    const existing = await Course.findOne({ code: code.toUpperCase() });
    if (existing) {
      res.status(400);
      throw new Error('A course with this code already exists');
    }
    course.code = code;
  }
  if (name !== undefined) course.name = name;
  if (description !== undefined) course.description = description;
  if (durationInMonths !== undefined) course.durationInMonths = durationInMonths;
  if (fee !== undefined) course.fee = fee;
  if (isActive !== undefined) course.isActive = isActive;

  await course.save();
  res.json({ success: true, data: course });
});

const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  const batchCount = await Batch.countDocuments({ course: course._id });
  if (batchCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a course that has batches assigned to it');
  }

  await course.deleteOne();
  res.json({ success: true, message: 'Course deleted' });
});

module.exports = { getCourses, getCourse, createCourse, updateCourse, deleteCourse };
