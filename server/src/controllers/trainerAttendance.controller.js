const asyncHandler = require('express-async-handler');
const TrainerAttendance = require('../models/TrainerAttendance');
const Batch = require('../models/Batch');
const Trainer = require('../models/Trainer');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');
const { scopeBatchFilterToCampus, requireAdminCampusScope } = require('../utils/campusScope');
const { ROLES } = require('../utils/constants');

// The check-in window is [scheduled start - 15min, scheduled end + 15min] —
// opens 15 minutes early, auto-closes 15 minutes after the class ends.
// Outside that window a normal check-in is rejected; a trainer is marked
// Late the moment check-in happens after the scheduled start (no separate
// tolerance beyond the window itself).
const CHECK_IN_WINDOW_MINUTES = 15;

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

// @desc    Record a trainer's check-in for a batch session. Only allowed
//          inside the check-in window — [scheduled start - 15min, scheduled
//          end + 15min] — for ADMIN; outside that window (too early, or
//          after the 15-minute-after-end grace period has passed and
//          attendance has auto-closed) is rejected. Late is computed
//          against the batch's slot start time: any check-in after the
//          scheduled start is Late, no additional tolerance.
//
//          SUPER_ADMIN always retains override authority: the window
//          restriction never applies to them, and they can also override an
//          ALREADY-recorded day (re-check-in for a trainer/batch/date that
//          already has a record — normally rejected as a duplicate). Either
//          form of override — outside the window, or overwriting an
//          existing record — always marks the trainer Present (isLate:
//          false), since it's an explicit manual correction, not a live
//          tardy check-in. A SUPER_ADMIN check-in that's inside the window
//          AND doesn't touch an existing record behaves exactly like an
//          ADMIN's — late is computed normally, same as anyone's real-time
//          check-in.
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
  const expectedEnd = batchDoc.slot ? combineDateAndTime(date, batchDoc.slot.endTime) : null;

  // No slot on this batch -> no window can be derived, so (same as before)
  // nothing is time-gated and nothing is ever marked late.
  let withinWindow = true;
  if (expectedStart) {
    const windowOpen = new Date(expectedStart.getTime() - CHECK_IN_WINDOW_MINUTES * 60000);
    const windowClose = expectedEnd ? new Date(expectedEnd.getTime() + CHECK_IN_WINDOW_MINUTES * 60000) : null;
    withinWindow = checkInDate >= windowOpen && (!windowClose || checkInDate <= windowClose);
  }

  const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
  const existing = await TrainerAttendance.findOne({ trainer, batch, date: new Date(date) });

  if (!isSuperAdmin) {
    if (!withinWindow) {
      res.status(403);
      throw new Error('Attendance is closed for this class — outside the 15-minute check-in window.');
    }
    if (existing) {
      res.status(400);
      throw new Error('This trainer already has an attendance record for this batch on this date');
    }
  }

  // A SUPER_ADMIN doing anything an ADMIN couldn't (checking in outside the
  // window, or re-checking-in a day that's already recorded) is an explicit
  // override — always Present. Otherwise (inside the window, no existing
  // record) lateness is computed normally, same as any other check-in.
  const isOverride = isSuperAdmin && (!withinWindow || Boolean(existing));

  let isLate = false;
  let lateMinutes = 0;
  if (expectedStart && !isOverride) {
    const diffMinutes = Math.round((checkInDate - expectedStart) / 60000);
    if (diffMinutes > 0) {
      isLate = true;
      lateMinutes = diffMinutes;
    }
  }

  const fields = {
    checkInTime: checkInDate,
    expectedStartTime: batchDoc.slot?.startTime,
    isLate,
    lateMinutes,
    markedBy: req.user._id,
    remarks,
  };

  let record;
  let statusCode;
  if (existing) {
    // Only reachable here for a SUPER_ADMIN override (ADMIN already rejected
    // above) — checkOutTime/duration/verification reset since this is a
    // fresh check-in event overwriting the prior one, not an edit of it.
    existing.set({
      ...fields,
      checkOutTime: undefined,
      durationMinutes: undefined,
      status: 'pending',
      verifiedBy: undefined,
      verifiedAt: undefined,
    });
    record = await existing.save();
    statusCode = 200;
  } else {
    try {
      record = await TrainerAttendance.create({ trainer, batch, date, status: 'pending', ...fields });
      statusCode = 201;
    } catch (err) {
      if (err.code !== 11000) throw err;
      // Race: another request created the record between our findOne and
      // this create.
      if (!isSuperAdmin) {
        // An ADMIN never overrides — same rejection as if `existing` had
        // been found up front.
        res.status(400);
        throw new Error('This trainer already has an attendance record for this batch on this date');
      }
      // SUPER_ADMIN's check-in is supposed to always succeed — retry as an
      // override against whatever just got created, rather than surfacing
      // a raw duplicate-key error.
      const race = await TrainerAttendance.findOne({ trainer, batch, date: new Date(date) });
      if (!race) throw err;
      race.set({ ...fields, checkOutTime: undefined, durationMinutes: undefined, status: 'pending', verifiedBy: undefined, verifiedAt: undefined });
      record = await race.save();
      statusCode = 200;
    }
  }

  res.status(statusCode).json({ success: true, data: await record.populate(POPULATE) });
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
