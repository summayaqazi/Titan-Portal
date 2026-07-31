const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const Course = require('../models/Course');
const City = require('../models/City');
const Campus = require('../models/Campus');
const Trainer = require('../models/Trainer');
const Slot = require('../models/Slot');
const Batch = require('../models/Batch');
const Enrollment = require('../models/Enrollment');

// @desc    Get top-level Super Admin dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private (SUPER_ADMIN)
const getStats = asyncHandler(async (req, res) => {
  const [
    totalStudents,
    enrolledStudentIds,
    totalCourses,
    totalCities,
    totalCampuses,
    totalTrainers,
    activeSlots,
    registrationOpenBatches,
  ] = await Promise.all([
    Student.countDocuments(),
    Enrollment.distinct('student', { status: 'enrolled' }),
    Course.countDocuments(),
    City.countDocuments(),
    Campus.countDocuments(),
    Trainer.countDocuments(),
    Slot.countDocuments({ isActive: true }),
    Batch.countDocuments({ registrationOpen: true }),
  ]);

  res.json({
    success: true,
    data: {
      totalStudents,
      enrolledStudents: enrolledStudentIds.length,
      totalCourses,
      totalCities,
      totalCampuses,
      totalTrainers,
      activeSlots,
      registrationOpenBatches,
    },
  });
});

const buildEnrollmentAnalytics = async ({ groupField, lookupCollection, sort, page, limit }) => {
  const sortDir = sort === 'asc' ? 1 : -1;
  const skip = (page - 1) * limit;

  const [result] = await Enrollment.aggregate([
    { $group: { _id: `$${groupField}`, count: { $sum: 1 } } },
    {
      $lookup: {
        from: lookupCollection,
        localField: '_id',
        foreignField: '_id',
        as: 'entity',
      },
    },
    { $unwind: '$entity' },
    { $project: { _id: 0, id: '$_id', name: '$entity.name', count: 1 } },
    { $sort: { count: sortDir, name: 1 } },
    {
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'value' }],
      },
    },
  ]);

  const rows = result?.rows ?? [];
  const total = result?.totalCount?.[0]?.value ?? 0;

  return {
    data: rows,
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
};

const parseSortAndPagination = (req) => {
  const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  return { sort, page, limit };
};

// @desc    Student enrollment counts grouped by campus
// @route   GET /api/dashboard/campus-analytics
// @access  Private (SUPER_ADMIN)
const getCampusAnalytics = asyncHandler(async (req, res) => {
  const { sort, page, limit } = parseSortAndPagination(req);

  const result = await buildEnrollmentAnalytics({
    groupField: 'campus',
    lookupCollection: Campus.collection.name,
    sort,
    page,
    limit,
  });

  res.json({ success: true, ...result });
});

// @desc    Student enrollment counts grouped by course
// @route   GET /api/dashboard/course-analytics
// @access  Private (SUPER_ADMIN)
const getCourseAnalytics = asyncHandler(async (req, res) => {
  const { sort, page, limit } = parseSortAndPagination(req);

  const result = await buildEnrollmentAnalytics({
    groupField: 'course',
    lookupCollection: Course.collection.name,
    sort,
    page,
    limit,
  });

  res.json({ success: true, ...result });
});

module.exports = { getStats, getCampusAnalytics, getCourseAnalytics };
