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
const Job = require('../models/Job');
const Application = require('../models/Application');
const Registration = require('../models/Registration');
const { buildJobCampusCityFilter } = require('../utils/jobScope');
const { ROLES } = require('../utils/constants');
const { LEGACY_UNREVIEWED_STUDENT_IDS } = require('../utils/legacyExclusions');

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

  // Same "qualifying student" definition as student.controller.js's own
  // buildStudentFilter (at least one non-'pending' Enrollment, and not one
  // of the two legacy pre-split records) — computed once here so both
  // branches below report the exact same "Total Students" the Students page
  // itself would show, never a larger raw Student.countDocuments().
  const legacyIds = new Set(LEGACY_UNREVIEWED_STUDENT_IDS);
  const qualifyingStudentIds = (await Enrollment.find({ status: { $ne: 'pending' } }).distinct('student')).filter(
    (id) => !legacyIds.has(id.toString())
  );

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
      // Job Portal — Super Admin Dashboard only (this whole branch only
      // runs for SUPER_ADMIN; ADMIN always takes the campus-scoped branch
      // below, which is deliberately NOT extended with these, per the
      // "Super Admin Dashboard only" scope of this change). Real counts
      // straight off the existing Job/Application/Enrollment collections —
      // never mock/static, and never a new model or endpoint.
      totalJobApplications,
      pendingJobApplications,
      openJobVacancies,
      // Student Registrations/Admissions — counted from the Registration
      // collection now, NOT Enrollment (see Registration.js's header
      // comment for why the two are separate modules as of this change). A
      // Registration is "did this person get approved to become a
      // student," a wholly separate question from Enrollment's own
      // per-course academic-admission status, which the Students module
      // still owns untouched.
      totalStudentRegistrations,
      pendingAdmissions,
      approvedRegistrations,
      rejectedRegistrations,
    ] = await Promise.all([
      // Excludes the two legacy pre-Registration-split records AND anyone
      // whose every enrollment is still 'pending' — see qualifyingStudentIds
      // above. Keeps this count consistent with what student.controller.js's
      // own getStudents (the Students page) shows.
      Student.countDocuments({ _id: { $in: qualifyingStudentIds } }),
      Enrollment.distinct('student', { status: 'enrolled' }),
      Course.countDocuments(),
      City.countDocuments(),
      Campus.countDocuments(),
      Trainer.countDocuments(),
      Slot.countDocuments({ isActive: true }),
      Batch.countDocuments({ registrationOpen: true }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'open' }),
      Registration.countDocuments(),
      Registration.countDocuments({ status: 'pending' }),
      Registration.countDocuments({ status: 'approved' }),
      Registration.countDocuments({ status: 'rejected' }),
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
        totalJobApplications,
        pendingJobApplications,
        openJobVacancies,
        totalStudentRegistrations,
        pendingAdmissions,
        approvedRegistrations,
        rejectedRegistrations,
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
    // Same qualifying-enrollment rule as the SUPER_ADMIN branch above,
    // scoped to this campus — a student whose only enrollment at THIS
    // campus is 'pending' doesn't count here, even if they qualify via an
    // enrollment at a different campus (this stat is specifically "students
    // qualifying at my campus").
    Enrollment.distinct('student', { campus: campusId, status: { $ne: 'pending' } }),
    Enrollment.distinct('student', { status: 'enrolled', campus: campusId }),
    Batch.distinct('course', { campus: campusId }),
    Trainer.countDocuments({ campuses: campusId }),
    Batch.distinct('slot', { campus: campusId }),
    Batch.countDocuments({ campus: campusId, registrationOpen: true }),
  ]);

  const activeSlots = await Slot.countDocuments({ _id: { $in: campusSlotIds }, isActive: true });

  // Job Applications / Available Jobs — Campus Admin Dashboard only. Same
  // campus-or-city scoping as the Jobs page itself (job.controller.js's
  // getAdminJobScope, sharing this exact filter-builder via utils/
  // jobScope.js so the three can never disagree on which jobs belong to
  // the selected campus). A campusId that doesn't resolve to a real Campus
  // (nothing selected yet, or an invalid one) falls back to a sentinel
  // that matches no Job, so both read zero rather than ever counting
  // another campus/city's data.
  const jobCampusCityFilter = (await buildJobCampusCityFilter(campusId)) || { campus: new mongoose.Types.ObjectId() };
  const scopedJobIds = await Job.distinct('_id', jobCampusCityFilter);
  // Applications submitted against those jobs — every status, not just
  // open jobs' (an application survives its job closing).
  const totalJobApplications = await Application.countDocuments({ job: { $in: scopedJobIds } });
  // Open/active postings only — never a Campus Admin's own count, since
  // they have no create permission at all (checkPermission on job.routes.js
  // rejects it outright), so every job reaching this filter was already
  // launched by Super Admin.
  const availableJobs = await Job.countDocuments({ ...jobCampusCityFilter, status: 'open' });

  // Same legacy exclusion as the SUPER_ADMIN branch above — computed here
  // as a post-filter since this branch derives its student set from
  // Enrollment.distinct rather than Student.countDocuments.
  const validStudentIds = studentIds.filter((id) => !LEGACY_UNREVIEWED_STUDENT_IDS.includes(id.toString()));

  res.json({
    success: true,
    data: {
      totalStudents: validStudentIds.length,
      enrolledStudents: enrolledStudentIds.length,
      totalCourses: campusCourseIds.length,
      totalCities: 1,
      totalCampuses: 1,
      totalTrainers,
      activeSlots,
      registrationOpenBatches,
      totalJobApplications,
      availableJobs,
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
