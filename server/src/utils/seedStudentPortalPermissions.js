// Fixes up ONLY the STUDENT role's 'dashboard' permission — flips its
// `view` flag to true so Student Portal Phase 1 (Dashboard) is actually
// reachable. Needed as a one-off, separate from seed.js's normal
// seedRoles() backfill: that backfill only ever ADDS module entries that
// are entirely missing from a role's permissions array (so it never
// clobbers a real admin customization) — but the STUDENT role's Role
// document already has a 'dashboard' entry (created with every other
// module, all false, before the Student Portal existed for anyone to
// configure), so the DEFAULT_ROLES change in seed.js alone can't reach it.
//
// Idempotent/safe to re-run — a no-op once view is already true. Touches
// nothing else on the STUDENT role (create/update/delete/export on
// 'dashboard' stay false, matching every other read-only module already
// granted to STUDENT), and no other role's Role document at all.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Role = require('./../models/Role');
const { ROLES } = require('./constants');

const run = async () => {
  await connectDB();

  const role = await Role.findOne({ name: ROLES.STUDENT });
  if (!role) {
    throw new Error('STUDENT role not found — run `npm run seed` first.');
  }

  const dashboardPerm = role.permissions.find((p) => p.module === 'dashboard');
  if (!dashboardPerm) {
    throw new Error("STUDENT role has no 'dashboard' permission entry — unexpected, aborting rather than guessing.");
  }

  if (dashboardPerm.view === true) {
    console.log('STUDENT role: dashboard.view is already true — nothing to do.');
  } else {
    dashboardPerm.view = true;
    await role.save();
    console.log('STUDENT role: dashboard.view set to true.');
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
