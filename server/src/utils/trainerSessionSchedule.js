const Batch = require('../models/Batch');

// Shared schedule-resolution core for every "what is this trainer doing
// right now" check — extracted out of trainerSelfAttendance.controller.js
// (the Trainer Portal's own Face + Location self-check-in) so the exact
// same logic backs the Admin/Super Admin Trainer QR scanner (see
// utils/trainerQrAttendance.js) instead of a second, possibly-drifting
// copy. One implementation, multiple callers.

const ACTIVE_STATUSES = ['ongoing', 'upcoming'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// `date.toISOString()` shifts the calendar date backwards for any server
// timezone ahead of UTC — format from local date parts instead. Used so the
// `date` any caller stores/looks up is byte-for-byte the same value shape
// the existing Admin manual checkIn already produces from a plain
// "YYYY-MM-DD" form field (`new Date(dateString)`), which is what actually
// matters: it's what the {trainer, batch, date} unique index and the
// Admin's own day-range history filter both key on, so a QR/self check-in
// and a manually-entered one for the same real day are never allowed to
// silently double up.
const formatLocalDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dayInBatchRange = (date, batch) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  if (batch.startDate && day < new Date(new Date(batch.startDate).setHours(0, 0, 0, 0))) return false;
  if (batch.endDate && day > new Date(new Date(batch.endDate).setHours(23, 59, 59, 999))) return false;
  return true;
};

const timeToMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const isSlotActiveNow = (slot, now) => {
  const startMin = timeToMinutes(slot?.startTime);
  const endMin = timeToMinutes(slot?.endTime);
  if (startMin === null || endMin === null) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startMin && nowMin <= endMin;
};

// A trainer's own batch(es) genuinely in session right now: today's day
// name is in the slot's days, today is within the batch's start/end range,
// and the current time is within the slot's start/end.
async function getInSessionBatches(trainerId) {
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];

  const batches = await Batch.find({ trainer: trainerId, status: { $in: ACTIVE_STATUSES } })
    .populate('course', 'name code')
    .populate('campus', 'name location attendanceRadiusMeters')
    .populate('slot', 'label days startTime endTime');

  return batches.filter((b) => b.slot?.days?.includes(dayName) && dayInBatchRange(now, b) && isSlotActiveNow(b.slot, now));
}

module.exports = { ACTIVE_STATUSES, DAY_NAMES, formatLocalDate, dayInBatchRange, isSlotActiveNow, getInSessionBatches };
