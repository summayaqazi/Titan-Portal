const TrainerAttendance = require('../models/TrainerAttendance');
const { formatLocalDate, getInSessionBatches } = require('./trainerSessionSchedule');
const { getCheckInWindow, getLateness } = require('./trainerCheckInWindow');

// Trainer ID Card QR attendance — the same technique the Student ID Card QR
// already uses (see utils/studentQrAttendance.js), applied to Trainer for
// the Admin/Super Admin QR scanner (trainerAttendance.controller.js#
// scanTrainerAttendance). Identifies the trainer from their scanned card,
// then reuses the exact same schedule resolution (getInSessionBatches) and
// check-in-window/lateness rules (trainerCheckInWindow.js) every other
// trainer check-in path already enforces — this is a new *entry point*
// (there was no Trainer QR verification logic to reuse before), not a new
// set of attendance rules.

// The Trainer ID Card QR encodes a short, plain-text string — a fixed
// prefix followed by nothing but the trainer's own Mongo _id — not JSON.
// This is deliberate, not a style choice: a JSON payload (`{"type":...,
// "trainerId":...,"name":...}`) pushes the QR's data length past the point
// where its own encoding needs a higher QR version, which packs the same
// physical printed square with more, smaller modules — and *that*, not a
// missing quiet-zone/error-correction setting, was the actual root cause of
// "This QR code could not be read" on real-world scans (a normal arm's-
// length phone camera, a slight angle, a bit of blur, or scanning a photo
// of the card all lose fine module detail first). Keeping the payload to
// just this prefix + the raw id keeps the QR at a low version (large,
// coarse modules) even at HIGH error correction — see
// client/src/utils/trainerIdCard.js's buildQrPayload, which both sides must
// agree on byte-for-byte.
const TRAINER_QR_PREFIX = 'TITAN-TRAINER:';

// A Mongo ObjectId's own hex-string shape — validated here so a corrupted/
// truncated decode (rare, but possible on a badly damaged or heavily
// obstructed code even with error correction) fails with a clear "could not
// be read" instead of surfacing a raw Mongoose CastError from the
// Trainer.findById below.
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

function parseTrainerQrPayload(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';

  // No prefix match at all — this is either a genuinely different QR (most
  // commonly a Student ID Card's own JSON-shaped code, scanned by mistake
  // in Trainer mode) or unrelated data entirely. Either way, jsQR already
  // did successfully decode *something* real (its own Reed-Solomon check
  // already rejects a truly unreadable/garbled frame client-side before
  // this ever gets called) — so the honest message is "wrong card", not
  // "couldn't be read".
  if (!text.startsWith(TRAINER_QR_PREFIX)) {
    throw httpError('This is not a valid Trainer ID Card QR code.', 400);
  }

  const trainerId = text.slice(TRAINER_QR_PREFIX.length).trim();
  if (!OBJECT_ID_RE.test(trainerId)) {
    throw httpError('This QR code could not be read. Please scan a Trainer ID Card.', 400);
  }

  return { trainerId };
}

// Checks the trainer in for whichever of their batches is in session right
// now. `campusScope` (an Admin's own scoped campus id, or undefined for
// unrestricted/Super Admin) is applied AFTER confirming a real session
// exists, so "no class right now" and "a class is happening but not at
// your campus" stay distinct, honest messages.
async function checkInTrainerFromActiveSession(trainerId, { campusScope, markedByUserId, remarks } = {}) {
  const sessions = await getInSessionBatches(trainerId);
  if (!sessions.length) {
    throw httpError('No scheduled session found for this trainer right now.', 400);
  }

  let scoped = sessions;
  if (campusScope) {
    scoped = sessions.filter((b) => String(b.campus?._id) === String(campusScope));
    if (!scoped.length) {
      throw httpError("You are not authorized to mark attendance for this trainer's campus.", 403);
    }
  }

  if (scoped.length > 1) {
    throw httpError(
      'More than one class is scheduled for this trainer at this exact time. Please contact the campus admin to resolve the schedule conflict.',
      409
    );
  }

  const batchDoc = scoped[0];
  const campus = batchDoc.campus;

  const now = new Date();
  const dateStr = formatLocalDate(now);
  const attendanceDate = new Date(dateStr);

  const { withinWindow, expectedStart } = getCheckInWindow(batchDoc.slot, dateStr, now);
  if (!withinWindow) {
    throw httpError('Attendance is closed for this class — outside the 15-minute check-in window.', 403);
  }

  const existing = await TrainerAttendance.findOne({ trainer: trainerId, batch: batchDoc._id, date: attendanceDate });
  if (existing) {
    throw httpError('This trainer already has an attendance record for this class today.', 400);
  }

  const { isLate, lateMinutes } = getLateness(expectedStart, now, false);

  let record;
  try {
    record = await TrainerAttendance.create({
      trainer: trainerId,
      batch: batchDoc._id,
      date: attendanceDate,
      checkInTime: now,
      expectedStartTime: batchDoc.slot?.startTime,
      isLate,
      lateMinutes,
      status: 'pending',
      markedBy: markedByUserId,
      remarks: remarks || 'Marked via Trainer ID Card QR scan',
      campus: campus?._id,
      verification: { method: 'qr-scan' },
    });
  } catch (err) {
    // Race: another request (e.g. a duplicate scan) created it first.
    if (err.code !== 11000) throw err;
    throw httpError('This trainer already has an attendance record for this class today.', 400);
  }

  return {
    id: record._id,
    status: record.status,
    checkInTime: record.checkInTime,
    isLate: record.isLate,
    lateMinutes: record.lateMinutes,
    batchCode: batchDoc.batchCode,
    courseName: batchDoc.course?.name,
    campusName: campus?.name,
  };
}

module.exports = { TRAINER_QR_PREFIX, parseTrainerQrPayload, checkInTrainerFromActiveSession };
