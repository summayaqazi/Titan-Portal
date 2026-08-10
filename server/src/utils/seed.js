require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Role = require('../models/Role');
const { ROLES, PERMISSION_MODULES } = require('./constants');
const seedDemoData = require('./seedDemoData');

const seedSuperAdmin = async () => {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@titan.com';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin123';

  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`Super admin already exists: ${email}`);
  } else {
    await User.create({
      name: 'Super Admin',
      email,
      password,
      role: ROLES.SUPER_ADMIN,
    });
    console.log(`Super admin created: ${email} / ${password}`);
  }
};

// Demo ADMIN account for testing/demoing the Admin Portal (campus-level
// administration). Safe to re-run — a no-op once the account exists.
const seedDemoAdmin = async () => {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@titan.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123';

  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`Demo admin already exists: ${email}`);
  } else {
    await User.create({
      name: 'Campus Admin',
      email,
      password,
      role: ROLES.ADMIN,
    });
    console.log(`Demo admin created: ${email} / ${password}`);
  }
};

// Builds a full module -> {view,create,update,delete,export} permission set.
// `overrides` maps module name to a partial flag object; modules not listed
// default to `fallback` for every action.
const buildPermissions = (fallback, overrides = {}) =>
  PERMISSION_MODULES.map((module) => ({
    module,
    view: fallback,
    create: fallback,
    update: fallback,
    delete: fallback,
    export: fallback,
    ...(overrides[module] || {}),
  }));

const DEFAULT_ROLES = [
  {
    name: ROLES.SUPER_ADMIN,
    label: 'Super Admin',
    description: 'Full, unrestricted access to every module across the institute.',
    isSystem: true,
    permissions: buildPermissions(true),
  },
  {
    name: ROLES.ADMIN,
    label: 'Admin',
    description: 'Campus-level administration. Configure exact access on the Roles & Permissions page.',
    isSystem: false,
    permissions: buildPermissions(false, {
      dashboard: { view: true },
      students: { view: true, create: true, update: true },
      courses: { view: true },
      batches: { view: true },
      cities: { view: true },
      campuses: { view: true },
      slots: { view: true },
      trainers: { view: true, create: true, update: true },
      attendance: { view: true, create: true, update: true },
      payments: { view: true, create: true },
      // Updation is intentionally withheld from the Admin Portal — leave
      // unset so it falls back to `false` for every action.
      profile: { view: true, update: true },
    }),
  },
  {
    name: ROLES.TRAINER,
    label: 'Trainer',
    description: 'Manages assigned batches and attendance. Configure exact access on the Roles & Permissions page.',
    isSystem: false,
    permissions: buildPermissions(false, {
      dashboard: { view: true },
      // Trainer views their own roster and attendance history — marking is
      // an Admin/Super Admin action, never a Trainer one.
      students: { view: true },
      attendance: { view: true },
      profile: { view: true, update: true },
      // Trainer fully manages their own assignments (never other trainers'
      // — enforced server-side by ownership checks, not this permission).
      assignments: { view: true, create: true, update: true, delete: true },
      // Same ownership model for quizzes (create/edit/publish/schedule/
      // delete their own) and for the course-progress breakdown they
      // maintain for their own batches.
      quizzes: { view: true, create: true, update: true, delete: true },
      progress: { view: true, create: true, update: true, delete: true },
    }),
  },
  {
    name: ROLES.STUDENT,
    label: 'Student',
    description: 'Views own enrollments, attendance and payments. Configure exact access on the Roles & Permissions page.',
    isSystem: false,
    permissions: buildPermissions(false, {
      // Student Portal Phase 1 (Dashboard) — same 'dashboard' module gate
      // the Trainer Portal's own Dashboard/Course Workspace routes use.
      dashboard: { view: true },
      payments: { view: true },
      attendance: { view: true },
      profile: { view: true, update: true },
      // Assignments phase: a student views assignments for their own
      // enrolled batches and creates (submits/resubmits) their own
      // submission — never update/delete, that stays a Trainer-only
      // review action (approve/reject/feedback) via the Trainer Portal.
      assignments: { view: true, create: true },
    }),
  },
];

const seedRoles = async () => {
  for (const role of DEFAULT_ROLES) {
    const existing = await Role.findOne({ name: role.name });
    if (!existing) {
      await Role.create(role);
      console.log(`Role created: ${role.name}`);
    } else {
      // Backfill permission entries for modules introduced after this role
      // was first seeded (e.g. the 'updation' module). Only adds missing
      // entries — never touches modules the role already has configured, so
      // operator edits made on the Roles & Permissions page are preserved.
      const existingModules = new Set(existing.permissions.map((p) => p.module));
      const missing = role.permissions.filter((p) => !existingModules.has(p.module));
      if (missing.length) {
        existing.permissions.push(...missing);
        await existing.save();
        console.log(`Role ${role.name}: backfilled permissions for ${missing.map((m) => m.module).join(', ')}`);
      }
    }
  }
};

const run = async () => {
  await connectDB();

  await seedSuperAdmin();
  await seedDemoAdmin();
  await seedRoles();

  const summary = await seedDemoData();
  console.log('Demo data seeded (safe to re-run, existing records are updated in place):');
  console.log(summary);

  await mongoose.connection.close();
  process.exit(0);
};

// Only auto-run the full seed when this file is executed directly
// (`npm run seed`) — lets other scripts `require('./seed')` to reuse a
// single piece (e.g. seedRoles) without triggering the rest as a side
// effect of the require.
if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seedRoles, DEFAULT_ROLES, seedDemoAdmin };
