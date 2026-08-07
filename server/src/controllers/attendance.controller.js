const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { scopeBatchFilterToCampus, requireAdminCampusScope } = require('../utils/campusScope');

const summarizeAttendance = async (enrollmentId) => {
  const records = await Attendance.find({ enrollment: enrollmentId });
  const counts = { present: 0, absent: 0, leave: 0, late: 0 };
  records.forEach((r) => {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  });
  const total = records.length;
  const percentPresent = total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
  return { total, counts, percentPresent };
};

const POPULATE = [
  { path: 'student', populate: { path: 'user', select: 'name email' } },
  { path: 'batch', select: 'batchCode' },
  { path: 'enrollment', select: 'rollNumber' },
  { path: 'markedBy', select: 'name' },
];

// @desc    Get the enrolled-student roster for a batch on a given date, with
//          existing attendance (if already marked) attached.
// @route   GET /api/attendance/roster?batch=&date=
const getRoster = asyncHandler(async (req, res) => {
  const { batch, date } = req.query;
  if (!batch || !date) {
    res.status(400);
    throw new Error('Batch and date are required');
  }

  const enrollments = await Enrollment.find({ batch, status: 'enrolled' })
    .populate({ path: 'student', populate: { path: 'user', select: 'name' } })
    .sort({ rollNumber: 1 });

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const existing = await Attendance.find({
    batch,
    date: { $gte: dayStart, $lte: dayEnd },
  });
  const existingByEnrollment = Object.fromEntries(existing.map((a) => [a.enrollment.toString(), a]));

  const roster = enrollments.map((en) => {
    const record = existingByEnrollment[en._id.toString()];
    return {
      enrollment: en._id,
      student: en.student?._id,
      studentName: en.student?.user?.name,
      rollNumber: en.rollNumber,
      status: record?.status || null,
      remarks: record?.remarks || '',
      attendanceId: record?._id || null,
    };
  });

  res.json({ success: true, data: roster });
});

// @desc    Mark/update attendance for a batch on a given date
// @route   POST /api/attendance/mark
const markAttendance = asyncHandler(async (req, res) => {
  const { batch, date, records } = req.body;

  if (!batch || !date || !Array.isArray(records) || records.length === 0) {
    res.status(400);
    throw new Error('Batch, date and at least one attendance record are required');
  }

  const batchExists = await Batch.findById(batch);
  if (!batchExists) {
    res.status(400);
    throw new Error('Selected batch does not exist');
  }

  const results = [];
  for (const record of records) {
    const { enrollment, status, remarks } = record;
    if (!enrollment || !status) continue;

    // eslint-disable-next-line no-await-in-loop
    const enrollmentDoc = await Enrollment.findById(enrollment);
    if (!enrollmentDoc) continue;

    // eslint-disable-next-line no-await-in-loop
    const attendance = await Attendance.findOneAndUpdate(
      { enrollment, date },
      {
        $set: {
          enrollment,
          student: enrollmentDoc.student,
          batch,
          date,
          status,
          remarks,
          markedBy: req.user._id,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    results.push(attendance);
  }

  res.json({ success: true, data: results });
});

// @desc    Bulk-mark attendance by roll number for a single date (defaults
//          every matched roll number to 'present') — backs the Multi
//          Attendance page. Reuses the same upsert-by-(enrollment,date)
//          logic as markAttendance rather than duplicating it.
// @route   POST /api/attendance/multi-mark
const multiMarkAttendance = asyncHandler(async (req, res) => {
  const { date, rollNumbers, status } = req.body;
  const targetStatus = status || 'present';

  if (!date || !Array.isArray(rollNumbers) || rollNumbers.length === 0) {
    res.status(400);
    throw new Error('Date and at least one roll number are required');
  }

  // For ADMIN, always scoped to their selected campus (or a sentinel that
  // matches nothing) — a roll number belonging to another campus must
  // never be matched/updated, even if the client didn't send `campus`.
  const campusScope = requireAdminCampusScope(req);

  const cleaned = [...new Set(rollNumbers.map((r) => String(r).trim()).filter(Boolean))];

  const updated = [];
  const notFound = [];

  for (const rollNumber of cleaned) {
    const enrollmentFilter = { rollNumber: { $regex: `^${rollNumber}$`, $options: 'i' } };
    if (campusScope) enrollmentFilter.campus = campusScope;

    // eslint-disable-next-line no-await-in-loop
    const enrollment = await Enrollment.findOne(enrollmentFilter).sort({ admissionDate: -1 });

    if (!enrollment) {
      notFound.push(rollNumber);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await Attendance.findOneAndUpdate(
      { enrollment: enrollment._id, date },
      {
        $set: {
          enrollment: enrollment._id,
          student: enrollment.student,
          batch: enrollment.batch,
          date,
          status: targetStatus,
          markedBy: req.user._id,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    updated.push(rollNumber);
  }

  res.json({
    success: true,
    data: { updatedCount: updated.length, notFoundCount: notFound.length, updated, notFound },
  });
});

// @desc    List attendance records with filters
// @route   GET /api/attendance
const getAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseListQuery(req);

  const filter = {};
  if (req.query.batch) filter.batch = req.query.batch;
  if (req.query.student) filter.student = req.query.student;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.date) {
    const dayStart = new Date(req.query.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(req.query.date);
    dayEnd.setHours(23, 59, 59, 999);
    filter.date = { $gte: dayStart, $lte: dayEnd };
  }
  // Attendance has no direct campus field, so scope via that campus's
  // batches. For ADMIN this is always enforced (real selection, or a
  // sentinel matching nothing) — never falls through to unscoped data.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope) {
    filter.batch = await scopeBatchFilterToCampus(campusScope, filter.batch);
  }

  const [items, total] = await Promise.all([
    Attendance.find(filter).populate(POPULATE).sort({ date: -1 }).skip(skip).limit(limit),
    Attendance.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const deleteAttendance = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Attendance record not found');
  }
  await record.deleteOne();
  res.json({ success: true, message: 'Attendance record deleted' });
});

// @desc    Look up a student by roll number (optionally scoped to a batch
//          and/or campus), returning enrollment/payment status and a recent
//          attendance summary in one call — backs the Attendance page's
//          roll-number search + student info preview card.
// @route   GET /api/attendance/lookup?rollNumber=&batch=&campus=
const lookupByRollNumber = asyncHandler(async (req, res) => {
  const { rollNumber, batch } = req.query;
  if (!rollNumber) {
    res.status(400);
    throw new Error('Roll number is required');
  }

  const filter = { rollNumber: { $regex: `^${rollNumber.trim()}$`, $options: 'i' } };
  if (batch) filter.batch = batch;
  // For ADMIN, always enforced — a roll number search must never surface
  // a student enrolled at a different campus, even without `campus` sent.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope) filter.campus = campusScope;

  const enrollment = await Enrollment.findOne(filter)
    .populate({ path: 'student', populate: [{ path: 'user', select: 'name email phone avatar' }, { path: 'city', select: 'name' }] })
    .populate('course', 'name code')
    .populate('batch', 'batchCode')
    .populate('campus', 'name')
    .sort({ admissionDate: -1 });

  if (!enrollment) {
    res.status(404);
    throw new Error('No enrollment found for this roll number');
  }

  const summary = await summarizeAttendance(enrollment._id);
  const recent = await Attendance.find({ enrollment: enrollment._id })
    .sort({ date: -1 })
    .limit(10)
    .select('date status remarks');

  res.json({
    success: true,
    data: {
      enrollment,
      student: enrollment.student,
      paymentStatus: enrollment.paymentStatus,
      attendanceSummary: summary,
      recentAttendance: recent,
    },
  });
});

// @desc    Recent attendance activity across all batches (most recently
//          marked first) — backs the Attendance page's Recent Activity feed.
// @route   GET /api/attendance/recent?limit=&campus=
const getRecentActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  const filter = {};
  // Same batch-lookup scoping as getAttendance, always enforced for ADMIN.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope) {
    filter.batch = await scopeBatchFilterToCampus(campusScope, filter.batch);
  }

  const records = await Attendance.find(filter).populate(POPULATE).sort({ updatedAt: -1 }).limit(limit);
  res.json({ success: true, data: records });
});

// @desc    Attendance summary (present/absent/leave/late counts + %) for a
//          single enrollment.
// @route   GET /api/attendance/summary/:enrollmentId
const getEnrollmentSummary = asyncHandler(async (req, res) => {
  const summary = await summarizeAttendance(req.params.enrollmentId);
  res.json({ success: true, data: summary });
});

module.exports = {
  getRoster,
  markAttendance,
  multiMarkAttendance,
  getAttendance,
  deleteAttendance,
  lookupByRollNumber,
  getRecentActivity,
  getEnrollmentSummary,
};
