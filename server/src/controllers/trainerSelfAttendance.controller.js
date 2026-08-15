const asyncHandler = require('express-async-handler');
const Trainer = require('../models/Trainer');
const TrainerAttendance = require('../models/TrainerAttendance');
const { getCheckInWindow, getLateness } = require('../utils/trainerCheckInWindow');
// Schedule resolution ("what is this trainer doing right now") is shared
// with the Admin/Super Admin Trainer QR scanner — see
// utils/trainerQrAttendance.js and utils/trainerSessionSchedule.js's own
// header comment for why this now lives there instead of only here.
const { formatLocalDate, getInSessionBatches } = require('../utils/trainerSessionSchedule');

// Trainer Portal self-service: Face + Schedule verified check-in. Entirely
// separate from trainerAttendance.controller.js's existing `checkIn`
// (Admin/Super Admin manual mark, untouched by this file) — this is the ONE
// self-service write a Trainer gets, and every route built on top of it
// lives under trainerPortal.routes.js's existing
// `protect, authorize(TRAINER), attachOwnTrainer` guard, so req.trainer is
// always resolved server-side from the logged-in account. A trainer can
// never reach or affect another trainer's record through this file —
// there is no trainer id anywhere in these request bodies.
//
// Location/geofence verification (GPS, campus coordinates, distance/radius)
// has been deliberately removed from this flow — a trainer no longer needs
// to be physically inside the campus to check in here. Face + liveness
// verification and the schedule/check-in-window rules below are untouched.
// Campus GPS/radius configuration itself (Campus model, Super Admin's
// Campuses page) is untouched too — it's simply no longer read by this
// file.
//
// Mirrors the structure of studentPortal.controller.js's own
// markOwnAttendanceViaQr (closest existing precedent for a self-service,
// schedule-gated attendance write): resolve what's active right now from
// the caller's own real data, reject with a specific reason otherwise,
// never trust a client-supplied batch/campus id.

const FACE_DESCRIPTOR_LENGTH = 128;
// face-api.js's own documented distance threshold for matching two
// descriptors from its 128-d recognition model — below this, "same person";
// above, "different person". Not a tunable knob elsewhere in the app.
const FACE_MATCH_THRESHOLD = 0.5;

function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const isValidDescriptor = (descriptor) =>
  Array.isArray(descriptor) &&
  descriptor.length === FACE_DESCRIPTOR_LENGTH &&
  descriptor.every((n) => typeof n === 'number' && Number.isFinite(n));

// @desc    The trainer's own batch(es) in session right now — what the Mark
//          Attendance page shows before requesting camera access, and empty
//          exactly when a check-in attempt would be rejected for "No
//          scheduled session found."
// @route   GET /api/trainer/me/attendance/sessions
// @access  Private (TRAINER)
const getCurrentSessions = asyncHandler(async (req, res) => {
  const sessions = await getInSessionBatches(req.trainer._id);
  res.json({
    success: true,
    data: sessions.map((b) => ({
      batchId: b._id,
      batchCode: b.batchCode,
      courseName: b.course?.name,
      campusName: b.campus?.name,
      slotLabel: b.slot?.label,
      startTime: b.slot?.startTime,
      endTime: b.slot?.endTime,
    })),
  });
});

// @desc    Whether the caller has a Face ID reference enrolled yet. Never
//          touches/returns the actual descriptor — enrollment status alone
//          is read off `faceEnrolledAt` (not `select: false`), so this
//          route never needs to load the biometric field at all.
// @route   GET /api/trainer/me/face-status
// @access  Private (TRAINER)
const getFaceStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { enrolled: Boolean(req.trainer.faceEnrolledAt), enrolledAt: req.trainer.faceEnrolledAt || null },
  });
});

// @desc    Enroll (or re-enroll) this trainer's own Face ID reference from a
//          live, liveness-checked camera capture. The client only ever
//          sends the 128-float descriptor extracted in-browser — never a
//          photo/frame — and it's always written to the caller's own
//          Trainer document (req.trainer, never a client-supplied id).
// @route   POST /api/trainer/me/face-enroll
// @access  Private (TRAINER)
const enrollFace = asyncHandler(async (req, res) => {
  const { descriptor } = req.body;
  if (!isValidDescriptor(descriptor)) {
    res.status(400);
    throw new Error('Invalid face data — please try enrolling again.');
  }

  const trainer = await Trainer.findById(req.trainer._id);
  trainer.faceDescriptor = descriptor;
  trainer.faceEnrolledAt = new Date();
  await trainer.save();

  res.json({ success: true, data: { enrolled: true, enrolledAt: trainer.faceEnrolledAt } });
});

// @desc    Mark the caller's own attendance for whichever of their batches
//          is in session right now, gated on Face verification + a real
//          scheduled session, on top of the exact same check-in-window/
//          lateness rules the existing Admin-facing checkIn already
//          enforces (see utils/trainerCheckInWindow.js). Fails closed with
//          a specific reason at the first check that doesn't pass — nothing
//          is ever marked on a partial pass. Location/geofence verification
//          (GPS, campus coordinates, distance/radius) is deliberately NOT
//          part of this check — a trainer is not required to be physically
//          inside the campus to check in here.
// @route   POST /api/trainer/me/attendance/check-in
// @access  Private (TRAINER)
const markOwnAttendance = asyncHandler(async (req, res) => {
  const { descriptor, liveness } = req.body;

  if (!isValidDescriptor(descriptor)) {
    res.status(400);
    throw new Error('Invalid face capture — please try again.');
  }

  // The client's own liveness check runs entirely in-browser (there's no
  // server-side way to re-verify liveness without the raw video, which is
  // deliberately never sent here) — this flag is trusted, but it only ever
  // gates whether a match is attempted at all. The match itself, next, is
  // decided here, not by anything the client asserts.
  if (!liveness?.passed) {
    res.status(400);
    throw new Error('Liveness check failed — please try again.');
  }

  const trainer = await Trainer.findById(req.trainer._id).select('+faceDescriptor');
  if (!trainer.faceDescriptor?.length) {
    res.status(400);
    throw new Error('Face ID not enrolled — enroll from your Profile page first.');
  }

  const distance = euclideanDistance(descriptor, trainer.faceDescriptor);
  if (distance > FACE_MATCH_THRESHOLD) {
    res.status(400);
    throw new Error('Face verification failed.');
  }

  const sessions = await getInSessionBatches(trainer._id);
  if (!sessions.length) {
    res.status(400);
    throw new Error('No scheduled session found.');
  }
  if (sessions.length > 1) {
    // A genuine scheduling conflict (two of this trainer's own batches
    // active at the exact same moment) — same fail-closed handling as the
    // Student QR self-attendance flow's own identical edge case.
    res.status(409);
    throw new Error(
      'More than one of your classes is scheduled at this exact time. Please contact your campus admin to resolve the schedule conflict.'
    );
  }
  const batchDoc = sessions[0];
  const campus = batchDoc.campus;

  // Same "YYYY-MM-DD" string shape a manual Admin check-in's own date-picker
  // field would send — see this file's top comment on why that match
  // matters (dedup + history-filter parity with the existing flow).
  const now = new Date();
  const dateStr = formatLocalDate(now);
  const attendanceDate = new Date(dateStr);

  const { withinWindow, expectedStart } = getCheckInWindow(batchDoc.slot, dateStr, now);
  if (!withinWindow) {
    res.status(403);
    throw new Error('Attendance is closed for this class — outside the 15-minute check-in window.');
  }

  const existing = await TrainerAttendance.findOne({ trainer: trainer._id, batch: batchDoc._id, date: attendanceDate });
  if (existing) {
    res.status(400);
    throw new Error('You already have an attendance record for this class today.');
  }

  const { isLate, lateMinutes } = getLateness(expectedStart, now, false);

  let record;
  try {
    record = await TrainerAttendance.create({
      trainer: trainer._id,
      batch: batchDoc._id,
      date: attendanceDate,
      checkInTime: now,
      expectedStartTime: batchDoc.slot?.startTime,
      isLate,
      lateMinutes,
      status: 'pending',
      markedBy: req.user._id,
      remarks: 'Self-marked via Face verification',
      campus: campus._id,
      verification: {
        method: 'self-verified',
        face: { matched: true, distance, livenessPassed: true },
      },
    });
  } catch (err) {
    // Race: another request (e.g. a duplicate tap) created it first.
    if (err.code !== 11000) throw err;
    res.status(400);
    throw new Error('You already have an attendance record for this class today.');
  }

  res.status(201).json({
    success: true,
    data: {
      id: record._id,
      status: record.status,
      checkInTime: record.checkInTime,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
      batchCode: batchDoc.batchCode,
      courseName: batchDoc.course?.name,
      campusName: campus.name,
    },
  });
});

module.exports = { getCurrentSessions, getFaceStatus, enrollFace, markOwnAttendance };
