// One-time migration marker (2026-08-14). These two Student `_id`s were
// created by the OLD, now-removed public-registration flow, BEFORE the
// Registration/Student split existed (see server/src/models/Registration.js's
// header comment for the split itself). Verified exhaustively at the time:
// neither has a Registration document linked by `_id`, email, or CNIC, and
// neither was ever reviewed/approved by an admin — they became Students the
// instant they submitted the old public form, which is exactly the behavior
// the split was built to stop. Under the CURRENT rule (a Student may only
// exist because of an explicit admin "Add Student" action or an approved
// Registration — see student.controller.js's createStudent and
// registration.controller.js's updateRegistrationStatus), neither qualifies.
//
// This list is NOT an ongoing filter mechanism and is not expected to ever
// grow: the current registration flow cannot produce another record shaped
// like this (no createdBy, no linked Registration) — verified live,
// repeatedly. It exists purely so these two specific legacy records stop
// appearing in the Students module without deleting their underlying
// User/Student/Enrollment documents — per explicit instruction, real-person
// data is never deleted as a side effect of a display/query fix.
const LEGACY_UNREVIEWED_STUDENT_IDS = [
  '6a7de780e44245efca5f427d', // Hiba — hibazahid@gmail.com
  '6a7ecd531859568249ea85ce', // Uzma — uzma@gmail.com
];

module.exports = { LEGACY_UNREVIEWED_STUDENT_IDS };
