const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');

// Shared core of the Student ID Card QR attendance flow — extracted out of
// studentPortal.controller.js's own markOwnAttendanceViaQr (the Student
// Portal's self-scan) so the exact same parsing + schedule-resolution +
// marking logic backs the Admin/Super Admin QR scanner (see
// attendance.controller.js#scanStudentAttendance) instead of a second,
// possibly-drifting copy. One implementation, two callers — the self-scan
// route additionally enforces "the card must belong to the account
// scanning it" itself (not here, since that check is meaningless for an
// admin scanning someone else's card on purpose).

// The `type` discriminator every Student ID Card QR encodes (see
// client/src/utils/studentIdCard.js's buildQrPayload — both sides must
// agree on this literal string). Doubles as a cheap first filter against
// scanning anything else — a Trainer ID card, a random URL, or any other QR
// someone might point the camera at — none of which will ever parse into
// `{ type: STUDENT_QR_TYPE }`.
const STUDENT_QR_TYPE = 'titan-student-id-card';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayInBatchRange = (date, batch) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  if (batch?.startDate && day < new Date(new Date(batch.startDate).setHours(0, 0, 0, 0))) return false;
  if (batch?.endDate && day > new Date(new Date(batch.endDate).setHours(23, 59, 59, 999))) return false;
  return true;
};

// "09:00" -> 540 (minutes since midnight) — Slot.startTime/endTime's own
// stored format (see models/Slot.js). Used only for a same-day minutes
// comparison, never combined into a Date, so it's immune to timezone shift.
const timeToMinutes = (hhmm) => {
  const [h, m] = (hhmm || '').split(':').map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null;
};

// Is `slot`'s own class window (start/end, both "HH:MM") currently open,
// right now, on the server's own clock?
const isSlotActiveNow = (slot, now) => {
  const startMin = timeToMinutes(slot?.startTime);
  const endMin = timeToMinutes(slot?.endTime);
  if (startMin === null || endMin === null) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startMin && nowMin <= endMin;
};

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// Parses/validates the raw QR text. Throws a statusCode-tagged Error (read
// by server/src/middleware/error.middleware.js) rather than touching `res`
// directly, so it works the same from either caller's asyncHandler.
function parseStudentQrPayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw httpError('This QR code could not be read. Please scan a Student ID Card.', 400);
  }
  if (!parsed || parsed.type !== STUDENT_QR_TYPE || !parsed.studentId) {
    throw httpError('This is not a valid Student ID Card QR code.', 400);
  }
  return parsed;
}

// Resolves whichever of `studentId`'s enrollments is in session right now
// and marks it present (idempotent — an already-marked day is left
// untouched and reported back, never overwritten). `campusScope` (an
// Admin's own scoped campus id, or undefined for unrestricted/Super Admin)
// is applied AFTER determining whether a real session exists at all, so
// "no class right now" and "a class is happening but not at your campus"
// get distinct, honest error messages instead of collapsing into one.
async function markStudentAttendanceFromActiveSession(studentId, { campusScope, markedByUserId, remarks } = {}) {
  const enrollments = await Enrollment.find({ student: studentId, status: 'enrolled' })
    .populate('course', 'name')
    .populate('batch', 'batchCode startDate endDate')
    .populate('slot', 'days startTime endTime');

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayName = DAY_NAMES[now.getDay()];

  const todaysEnrollments = enrollments.filter((e) => e.slot?.days?.includes(dayName) && dayInBatchRange(today, e.batch));
  if (!todaysEnrollments.length) {
    throw httpError('This student has no class scheduled today.', 400);
  }

  // Narrowed further to whichever of today's classes is actually in
  // session RIGHT NOW — a student enrolled in multiple courses that both
  // meet today can only ever be marked present for whichever one's class
  // window is actually open at this moment.
  const activeNowEnrollments = todaysEnrollments.filter((e) => isSlotActiveNow(e.slot, now));
  if (!activeNowEnrollments.length) {
    throw httpError('No class is currently in session for this student. Attendance can only be marked during the scheduled class time.', 400);
  }

  let scoped = activeNowEnrollments;
  if (campusScope) {
    scoped = activeNowEnrollments.filter((e) => String(e.campus) === String(campusScope));
    if (!scoped.length) {
      throw httpError("You are not authorized to mark attendance for this student's campus.", 403);
    }
  }

  // Two classes genuinely in session at the exact same moment means their
  // slots overlap — a scheduling conflict, not a normal case. Fail closed
  // rather than guess which one was meant.
  if (scoped.length > 1) {
    throw httpError(
      'More than one class is scheduled at this exact time. Please contact the campus admin to resolve the schedule conflict.',
      409
    );
  }

  const records = [];
  for (const e of scoped) {
    // Atomic upsert with $setOnInsert (not $set) — if a record for
    // {enrollment, date} already exists (marked by anyone, any status),
    // this is a complete no-op that just returns it untouched; only a
    // genuinely missing record gets the new 'present' fields inserted.
    // eslint-disable-next-line no-await-in-loop
    const result = await Attendance.findOneAndUpdate(
      { enrollment: e._id, date: today },
      {
        $setOnInsert: {
          enrollment: e._id,
          student: studentId,
          batch: e.batch?._id,
          date: today,
          status: 'present',
          markedBy: markedByUserId,
          remarks: remarks || 'Marked via Student ID Card QR scan',
        },
      },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true, setDefaultsOnInsert: true }
    );
    const doc = result.value;
    const alreadyMarked = Boolean(result.lastErrorObject?.updatedExisting);
    records.push({ courseName: e.course?.name, batchCode: e.batch?.batchCode, status: doc.status, alreadyMarked });
  }

  const marked = records.some((r) => !r.alreadyMarked);
  return { records, marked, allAlreadyMarked: !marked };
}

module.exports = { STUDENT_QR_TYPE, parseStudentQrPayload, markStudentAttendanceFromActiveSession };
