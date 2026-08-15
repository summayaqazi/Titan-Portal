// Fixes up the TRAINER role's `attendance` permission for the Face +
// Location Attendance feature — flips `create` to true so the new
// self-service check-in route (checkPermission('attendance', 'create'), see
// trainerPortal.routes.js) is actually reachable. Needed as a one-off,
// separate from seed.js's normal seedRoles() backfill: that backfill only
// ever ADDS module entries that are entirely missing from a role's
// permissions array (so it never clobbers a real admin customization) — but
// the TRAINER role's Role document already has an `attendance` entry (view:
// true only, from when the portal was read-only), so the DEFAULT_ROLES
// change in seed.js alone can't flip an existing-but-false flag on it.
// Exact same shape/reasoning as seedStudentPortalPermissions.js's own fixup
// for the Student QR self-attendance feature.
//
// Idempotent/safe to re-run — a no-op for anything already true. Touches
// only `attendance.create`; every other action on every other module is
// left exactly as configured (via seed.js's own defaults or any admin
// customization made on the Roles & Permissions page since).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Role = require('./../models/Role');
const { ROLES } = require('./constants');

const FIXUPS = {
  attendance: { create: true },
};

const run = async () => {
  await connectDB();

  const role = await Role.findOne({ name: ROLES.TRAINER });
  if (!role) {
    throw new Error('TRAINER role not found — run `npm run seed` first.');
  }

  let changed = false;
  for (const [moduleName, actions] of Object.entries(FIXUPS)) {
    const perm = role.permissions.find((p) => p.module === moduleName);
    if (!perm) {
      console.warn(`TRAINER role has no '${moduleName}' permission entry — skipping (run seedRoles() first).`);
      continue;
    }
    for (const [action, value] of Object.entries(actions)) {
      if (perm[action] !== value) {
        perm[action] = value;
        changed = true;
        console.log(`TRAINER role: ${moduleName}.${action} set to ${value}.`);
      }
    }
  }

  if (changed) {
    await role.save();
  } else {
    console.log('TRAINER role: everything already up to date — nothing to do.');
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
