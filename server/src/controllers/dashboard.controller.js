const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const Course = require('../models/Course');
const City = require('../models/City');
const Campus = require('../models/Campus');
const Trainer = require('../models/Trainer');
const Slot = require('../models/Slot');
const Batch = require('../models/Batch');
const Enrollment = require('../models/Enrollment');
const { ROLES } = require('../utils/constants');

// ADMIN's dashboard is driven entirely by the Campus Selector — never
// auto-locked to a single campus. Returns the campus ObjectId to scope
// every query to (from `?campus=`, the id the admin picked in the
// dropdown), or null for SUPER_ADMIN (unscoped/global). The dropdown itself
// is populated from GET /api/campuses, already gated by the admin's own
// `campuses` module permission — so anything reaching this function as
// `req.query.campus` is a campus the admin was permitted to list in the
// first place. No campus selected yet (or an invalid id) resolves to a
// sentinel that matches nothing, so the dashboard reads zero rather than
// ever falling back to global/mixed data.
const getScopeCampusId = (req) => {
  if (req.user.role !== ROLES.ADMIN) return null;
  const requested = req.query.campus;
  if (requested && mongoose.Types.ObjectId.isValid(requested)) {
    return new mongoose.Types.ObjectId(requested);
  }
  return new mongoose.Types.ObjectId();
};

// @desc    Get top-level dashboard statistics — scoped to the caller's
//          campus for ADMIN, global for SUPER_ADMIN.
// @route   GET /api/dashboard/stats
// @access  Private (SUPER_ADMIN, ADMIN)
const getStats = asyncHandler(async (req, res) => {
  const campusId = getScopeCampusId(req);

  if (!campusId) {
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

    return res.json({
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
  }

  const [
    studentIds,
    enrolledStudentIds,
    campusCourseIds,
    totalTrainers,
    campusSlotIds,
    registrationOpenBatches,
  ] = await Promise.all([
    Enrollment.distinct('student', { campus: campusId }),
    Enrollment.distinct('student', { status: 'enrolled', campus: campusId }),
    Batch.distinct('course', { campus: campusId }),
    Trainer.countDocuments({ campuses: campusId }),
    Batch.distinct('slot', { campus: campusId }),
    Batch.countDocuments({ campus: campusId, registrationOpen: true }),
  ]);

  const activeSlots = await Slot.countDocuments({ _id: { $in: campusSlotIds }, isActive: true });

  res.json({
    success: true,
    data: {
      totalStudents: studentIds.length,
      enrolledStudents: enrolledStudentIds.length,
      totalCourses: campusCourseIds.length,
      totalCities: 1,
      totalCampuses: 1,
      totalTrainers,
      activeSlots,
      registrationOpenBatches,
    },
  });
});

const buildEnrollmentAnalytics = async ({ groupField, lookupCollection, sort, page, limit, campusId }) => {
  const sortDir = sort === 'asc' ? 1 : -1;
  const skip = (page - 1) * limit;

  const [result] = await Enrollment.aggregate([
    ...(campusId ? [{ $match: { campus: campusId } }] : []),
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

// @desc    Student enrollment counts grouped by campus — scoped to the
//          caller's own campus for ADMIN (a single row), global for
//          SUPER_ADMIN.
// @route   GET /api/dashboard/campus-analytics
// @access  Private (SUPER_ADMIN, ADMIN)
const getCampusAnalytics = asyncHandler(async (req, res) => {
  const { sort, page, limit } = parseSortAndPagination(req);

  const result = await buildEnrollmentAnalytics({
    groupField: 'campus',
    lookupCollection: Campus.collection.name,
    sort,
    page,
    limit,
    campusId: getScopeCampusId(req),
  });

  res.json({ success: true, ...result });
});

// @desc    Student enrollment counts grouped by course — scoped to the
//          caller's own campus for ADMIN, global for SUPER_ADMIN.
// @route   GET /api/dashboard/course-analytics
// @access  Private (SUPER_ADMIN, ADMIN)
const getCourseAnalytics = asyncHandler(async (req, res) => {
  const { sort, page, limit } = parseSortAndPagination(req);

  const result = await buildEnrollmentAnalytics({
    groupField: 'course',
    lookupCollection: Course.collection.name,
    sort,
    page,
    limit,
    campusId: getScopeCampusId(req),
  });

  res.json({ success: true, ...result });
});

module.exports = { getStats, getCampusAnalytics, getCourseAnalytics };
