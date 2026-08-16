// Shared check-in-window/lateness logic for Trainer attendance — extracted
// out of trainerAttendance.controller.js's existing `checkIn` (Admin/Super
// Admin manual mark) so the new Trainer Portal self-check-in
// (trainerSelfAttendance.controller.js) computes the window and lateness
// identically instead of re-implementing it. One implementation, two
// callers — this is what guarantees "existing attendance timing rules"
// stay exactly as they were, rather than relying on two copies staying in
// sync by hand.

// The check-in window is [scheduled start - 15min, scheduled end + 15min] —
// opens 15 minutes early, auto-closes 15 minutes after the class ends.
// Outside that window a normal check-in is rejected; a trainer is marked
// Late the moment check-in happens after the scheduled start (no separate
// tolerance beyond the window itself).
const CHECK_IN_WINDOW_MINUTES = 15;

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

// Returns { withinWindow, expectedStart, expectedEnd } for a given slot/date
// against a given check-in instant. No slot -> nothing is time-gated
// (withinWindow: true, expectedStart: null), same as before.
const getCheckInWindow = (slot, date, checkInDate) => {
  const expectedStart = slot ? combineDateAndTime(date, slot.startTime) : null;
  const expectedEnd = slot ? combineDateAndTime(date, slot.endTime) : null;

  let withinWindow = true;
  if (expectedStart) {
    const windowOpen = new Date(expectedStart.getTime() - CHECK_IN_WINDOW_MINUTES * 60000);
    const windowClose = expectedEnd ? new Date(expectedEnd.getTime() + CHECK_IN_WINDOW_MINUTES * 60000) : null;
    withinWindow = checkInDate >= windowOpen && (!windowClose || checkInDate <= windowClose);
  }

  return { withinWindow, expectedStart, expectedEnd };
};

// Returns { isLate, lateMinutes } for a check-in against the slot's expected
// start. `isOverride` (a Super Admin override) always yields { isLate: false,
// lateMinutes: 0 }, since an explicit manual correction is never marked late.
const getLateness = (expectedStart, checkInDate, isOverride) => {
  if (!expectedStart || isOverride) return { isLate: false, lateMinutes: 0 };
  const diffMinutes = Math.round((checkInDate - expectedStart) / 60000);
  return diffMinutes > 0 ? { isLate: true, lateMinutes: diffMinutes } : { isLate: false, lateMinutes: 0 };
};

module.exports = { CHECK_IN_WINDOW_MINUTES, combineDateAndTime, getCheckInWindow, getLateness };
