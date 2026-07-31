const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

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

module.exports = { getRoster, markAttendance, getAttendance, deleteAttendance };
