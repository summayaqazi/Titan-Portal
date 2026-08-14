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
      // Campus Admin gets READ-ONLY job access — view only (job.controller.js
      // additionally scopes what they can see to jobs tagged with their own
      // assigned campus). No create/update/delete/export: job
      // creation/editing/publishing/closing is Super-Admin-only, same as
      // 'applications' below — a config-only change (Roles & Permissions
      // page) to grant more later if ever needed.
      jobs: { view: true },
      // Application review/shortlist/approve/reject stays a Super-Admin-only
      // action — intentionally left unset so it falls back to `false` for
      // every action, same as 'updation' above.
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
      // view: existing read-only attendance history/summary. create: the
      // one self-service write — marking today's own attendance by
      // scanning their own Student ID Card QR (see
      // markOwnAttendanceViaQr in studentPortal.controller.js). Never
      // update/delete — an already-marked record can't be changed by the
      // student, only Trainer/Admin retain that via attendance.controller.js.
      attendance: { view: true, create: true },
      profile: { view: true, update: true },
      // Read-only curriculum progress, same reasoning as attendance above.
      progress: { view: true },
      // Assignments phase: a student views assignments for their own
      // enrolled batches and creates (submits/resubmits) their own
      // submission — never update/delete, that stays a Trainer-only
      // review action (approve/reject/feedback) via the Trainer Portal.
      assignments: { view: true, create: true },
      // Quiz phase: a student views quizzes for their own enrolled batches
      // and creates their own attempts (start + submit) — never
      // update/delete, quiz authoring stays a Trainer-only action.
      quizzes: { view: true, create: true },
      // Feedback phase: a student creates their own feedback (bug/idea/
      // other) — no 'view' grant, since there's no feedback-history/inbox
      // UI in this phase for a student to view (create-only is enough for
      // the Send Feedback workflow).
      feedback: { create: true },
    }),
  },
  {
    // Job Portal — a job applicant's account. Distinct from STUDENT: an
    // applicant only ever sees their own applications, never any academic
    // (Student/Enrollment) data, and vice versa.
    name: ROLES.APPLICANT,
    label: 'Applicant',
    description: 'Job applicant account. Applies for jobs and views their own application status.',
    isSystem: false,
    permissions: buildPermissions(false, {
      // View/create their own applications only — enforced by ownership
      // scoping in applicantPortal.controller.js, not by this permission
      // grid, same convention as STUDENT's own assignments/quizzes grants
      // above. Also gates the Applicant Dashboard and My Applications
      // pages (Phase 4) — both are just applications views, so they reuse
      // this module rather than a dedicated 'dashboard' grant, same
      // reasoning TRAINER_NAV's Calendar entry already documents for
      // reusing 'dashboard' instead of adding a module of its own.
      applications: { view: true, create: true },
      // Phase 4 — the read-only Applicant Profile page (Name/Email/Account
      // status from the existing User record).
      profile: { view: true },
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
