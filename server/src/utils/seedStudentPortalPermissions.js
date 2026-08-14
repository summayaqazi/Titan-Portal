// Fixes up the STUDENT role's permissions for modules introduced *after*
// its Role document already existed — flips specific view/create flags to
// true so each Student Portal phase (Dashboard, then Assignments, then
// Progress/Attendance, then Quiz, then Feedback, ...) is actually
// reachable. Needed as a one-off, separate from seed.js's normal
// seedRoles() backfill: that backfill only ever ADDS module entries that
// are entirely missing from a role's permissions array (so it never
// clobbers a real admin customization) — but the STUDENT role's Role
// document already has entries for every module that existed at the time
// it was first seeded (all false), so the DEFAULT_ROLES change in seed.js
// alone can't flip an existing-but-false entry.
//
// Idempotent/safe to re-run — a no-op for anything already true. Touches
// only the specific flags listed below; every other action on every other
// module is left exactly as configured (via seed.js's own defaults or any
// admin customization made on the Roles & Permissions page since).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Role = require('./../models/Role');
const { ROLES } = require('./constants');

// module -> { action: true, ... } — only the flags that need flipping.
const FIXUPS = {
  dashboard: { view: true },
  assignments: { view: true, create: true },
  // Phase 3 — Progress and Attendance are both read-only for students.
  progress: { view: true },
  // create: added for the "Scan QR" self-attendance feature — marking
  // today's own record by scanning their own Student ID Card QR. No
  // update/delete — an already-marked record stays Trainer/Admin-only to change.
  attendance: { view: true, create: true },
  // Phase 5 — Quiz: view own quizzes/results, create own attempts
  // (start + submit). No update/delete — quiz authoring stays Trainer-only.
  quizzes: { view: true, create: true },
  // Phase 8 — Feedback: create-only (no history/inbox view in this phase).
  feedback: { create: true },
};

const run = async () => {
  await connectDB();

  const role = await Role.findOne({ name: ROLES.STUDENT });
  if (!role) {
    throw new Error('STUDENT role not found — run `npm run seed` first.');
  }

  let changed = false;
  for (const [moduleName, actions] of Object.entries(FIXUPS)) {
    const perm = role.permissions.find((p) => p.module === moduleName);
    if (!perm) {
      console.warn(`STUDENT role has no '${moduleName}' permission entry — skipping (run seedRoles() first).`);
      continue;
    }
    for (const [action, value] of Object.entries(actions)) {
      if (perm[action] !== value) {
        perm[action] = value;
        changed = true;
        console.log(`STUDENT role: ${moduleName}.${action} set to ${value}.`);
      }
    }
  }

  if (changed) {
    await role.save();
  } else {
    console.log('STUDENT role: everything already up to date — nothing to do.');
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
