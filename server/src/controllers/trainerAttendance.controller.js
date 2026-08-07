const asyncHandler = require('express-async-handler');
const TrainerAttendance = require('../models/TrainerAttendance');
const Batch = require('../models/Batch');
const Trainer = require('../models/Trainer');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { scopeBatchFilterToCampus, requireAdminCampusScope } = require('../utils/campusScope');

const GRACE_MINUTES = 10;

const POPULATE = [
  { path: 'trainer', populate: { path: 'user', select: 'name email avatar' } },
  { path: 'batch', populate: [{ path: 'course', select: 'name' }, { path: 'slot', select: 'label startTime endTime' }] },
  { path: 'markedBy', select: 'name' },
  { path: 'verifiedBy', select: 'name' },
];

// Combines the attendance `date` with a slot's "HH:MM" startTime into a
// concrete Date, so a check-in can be compared against when the session was
// actually supposed to start.
const combineDateAndTime = (date, hhmm) => {
  if (!hhmm) return null;
  const [hours, minutes] = hhmm.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

const getTrainerAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parseListQuery(req);

  const filter = {};
  // A forced scope — set by trusted server-side middleware, e.g. the
  // Trainer Portal's own "my attendance history" route — always wins over
  // whatever the client happened to send. This is a plain req property, not
  // req.query: Express 5 makes req.query a read-only getter, so a
  // middleware assigning req.query.trainer = ... would silently no-op and
  // this filter would fall through to the (unscoped) query value instead.
  if (req.forceTrainerId) {
    filter.trainer = req.forceTrainerId;
  } else if (req.query.trainer) {
    filter.trainer = req.query.trainer;
  }
  if (req.query.batch) filter.batch = req.query.batch;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.date) {
    const dayStart = new Date(req.query.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(req.query.date);
    dayEnd.setHours(23, 59, 59, 999);
    filter.date = { $gte: dayStart, $lte: dayEnd };
  }
  // Always enforced for ADMIN — never falls through to unscoped data.
  const campusScope = requireAdminCampusScope(req);
  if (campusScope) {
    filter.batch = await scopeBatchFilterToCampus(campusScope, filter.batch);
  }

  const [items, total] = await Promise.all([
    TrainerAttendance.find(filter).populate(POPULATE).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
    TrainerAttendance.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

// @desc    Record a trainer's check-in for a batch session. Computes
//          lateness against the batch's slot start time (with a grace
//          period) and always starts as a "pending" request awaiting
//          verification.
// @route   POST /api/trainer-attendance/check-in
const checkIn = asyncHandler(async (req, res) => {
  const { trainer, batch, date, checkInTime, remarks } = req.body;

  if (!trainer || !batch || !date || !checkInTime) {
    res.status(400);
    throw new Error('Trainer, batch, date and check-in time are required');
  }

  const [trainerDoc, batchDoc] = await Promise.all([Trainer.findById(trainer), Batch.findById(batch).populate('slot')]);
  if (!trainerDoc) {
    res.status(400);
    throw new Error('Selected trainer does not exist');
  }
  if (!batchDoc) {
    res.status(400);
    throw new Error('Selected batch does not exist');
  }

  const checkInDate = new Date(checkInTime);
  const expectedStart = batchDoc.slot ? combineDateAndTime(date, batchDoc.slot.startTime) : null;

  let isLate = false;
  let lateMinutes = 0;
  if (expectedStart) {
    const diffMinutes = Math.round((checkInDate - expectedStart) / 60000);
    if (diffMinutes > GRACE_MINUTES) {
      isLate = true;
      lateMinutes = diffMinutes;
    }
  }

  let record;
  try {
    record = await TrainerAttendance.create({
      trainer,
      batch,
      date,
      checkInTime: checkInDate,
      expectedStartTime: batchDoc.slot?.startTime,
      isLate,
      lateMinutes,
      status: 'pending',
      markedBy: req.user._id,
      remarks,
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400);
      throw new Error('This trainer already has an attendance record for this batch on this date');
    }
    throw err;
  }

  res.status(201).json({ success: true, data: await record.populate(POPULATE) });
});

// @desc    Record check-out time and compute session duration.
// @route   POST /api/trainer-attendance/:id/check-out
const checkOut = asyncHandler(async (req, res) => {
  const record = await TrainerAttendance.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Attendance record not found');
  }
  if (record.checkOutTime) {
    res.status(400);
    throw new Error('This attendance record has already been checked out');
  }

  const checkOutDate = req.body.checkOutTime ? new Date(req.body.checkOutTime) : new Date();
  if (checkOutDate <= record.checkInTime) {
    res.status(400);
    throw new Error('Check-out time must be after check-in time');
  }

  record.checkOutTime = checkOutDate;
  record.durationMinutes = Math.round((checkOutDate - record.checkInTime) / 60000);
  await record.save();

  res.json({ success: true, data: await record.populate(POPULATE) });
});

// @desc    Verify or reject a pending trainer attendance request.
// @route   PATCH /api/trainer-attendance/:id/verify
const verifyAttendance = asyncHandler(async (req, res) => {
  const { action, remarks } = req.body;
  if (!['verify', 'reject'].includes(action)) {
    res.status(400);
    throw new Error('Action must be either "verify" or "reject"');
  }

  const record = await TrainerAttendance.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Attendance record not found');
  }

  record.status = action === 'verify' ? 'verified' : 'rejected';
  record.verifiedBy = req.user._id;
  record.verifiedAt = new Date();
  if (remarks !== undefined) record.remarks = remarks;
  await record.save();

  res.json({ success: true, data: await record.populate(POPULATE) });
});

const deleteTrainerAttendance = asyncHandler(async (req, res) => {
  const record = await TrainerAttendance.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Attendance record not found');
  }
  await record.deleteOne();
  res.json({ success: true, message: 'Attendance record deleted' });
});

module.exports = {
  getTrainerAttendance,
  checkIn,
  checkOut,
  verifyAttendance,
  deleteTrainerAttendance,
};
