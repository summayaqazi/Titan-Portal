// One-off, additive-only content fill-in for the public Course
// Registration and Careers/Jobs pages. Two independent, idempotent steps:
//
//  1. Course descriptions — every real Course in the database (created via
//     the Super Admin Courses UI, some pre-dating this script) already has
//     its real name/code/duration/fee, but several were never given a
//     description, so the public Courses/Course Details pages had nothing
//     to show there. This sets `description` ONLY on a course that doesn't
//     already have one (checked by `code`, matching every other course
//     lookup in this codebase) — name/code/duration/fee/isActive are never
//     touched, so nothing already entered through the Admin UI is at risk
//     of being overwritten. Re-running this after an Admin later edits a
//     description is also safe: a non-empty description is left alone.
//
//  2. Job postings — the Job Portal shipped with zero real postings (an
//     empty collection, confirmed live), so the public Careers page had
//     nothing to show. Gated on a global `Job.countDocuments() === 0`
//     check (same "only ever run once" contract seedSampleSubmissions()
//     in seedDemoData.js already uses for the same reason) — it never runs,
//     and never duplicates postings, once any real job exists (including
//     ones an Admin creates by hand afterward). Attributed to the real
//     Super Admin account via the same createdBy/updatedBy fields
//     job.controller.js's own createJob sets, so these are
//     indistinguishable from a job an admin created through the UI.
//
// Never deletes anything. Safe to re-run.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Course = require('../models/Course');
const Job = require('../models/Job');
const User = require('../models/User');
const { ROLES } = require('./constants');

const COURSE_DESCRIPTIONS = {
  WEBDEV:
    'A hands-on programme covering front-end and back-end web development — HTML, CSS, JavaScript, a modern framework, and a Node.js/database backend — culminating in a full, deployable capstone project for your portfolio.',
  MOBDEV:
    'Learn to design, build, and publish real mobile applications for Android and iOS from a single codebase, covering UI design, app state, device APIs, and connecting to a live backend.',
  GFXDS:
    'A practical, project-based course in visual design — typography, layout, branding, and industry-standard design software — for anyone looking to start a career in graphic design or strengthen an existing one.',
  DGMKT:
    'Covers the full digital marketing toolkit: SEO, social media marketing, paid advertising, content strategy, and analytics, with real campaigns you plan and run as part of the course.',
  CLDCMP:
    'An introduction to cloud infrastructure and services — deployment, storage, networking, and security on modern cloud platforms — for students aiming to work in cloud/DevOps roles.',
  CYBRSEC:
    'Covers core information security concepts, common attack techniques, and defensive practices, with hands-on labs so you leave able to secure real systems and networks, not just describe how to.',
  MODWEB:
    'An advanced, project-heavy track for students who already know the web development basics — modern frameworks, full-stack architecture, and mobile app development, brought together in one extended programme.',
};

const seedCourseDescriptions = async () => {
  let updated = 0;
  let alreadyHadOne = 0;
  let notFound = 0;

  for (const [code, description] of Object.entries(COURSE_DESCRIPTIONS)) {
    // eslint-disable-next-line no-await-in-loop
    const course = await Course.findOne({ code });
    if (!course) {
      notFound += 1;
      continue;
    }
    if (course.description && course.description.trim()) {
      alreadyHadOne += 1;
      continue;
    }
    course.description = description;
    // eslint-disable-next-line no-await-in-loop
    await course.save();
    updated += 1;
  }

  return { updated, alreadyHadOne, notFound };
};

const JOB_DEFS = [
  {
    title: 'Web Development Trainer',
    jobType: 'full_time',
    experience: '2+ years',
    qualification: 'BS/MS in Computer Science or a related field',
    about:
      'Teach our Web Development course cohorts — HTML/CSS/JavaScript through a modern framework and a Node.js backend — and mentor students through their capstone projects.',
    subjectCommand: 'Web Development (HTML, CSS, JavaScript, a modern front-end framework, Node.js)',
    skills: ['JavaScript', 'React', 'Node.js', 'REST APIs', 'Teaching/Mentoring'],
    expectedSalary: 'PKR 80,000 - 120,000',
    languages: ['English', 'Urdu'],
    description:
      'TITAN Institute is looking for an experienced Web Development trainer to deliver classroom sessions, review student projects, and keep the course curriculum current with industry practice. You will teach scheduled batches at one of our campuses, track student progress, and coordinate with the academic team on assignments and assessments.',
    requirements: [
      'Proven hands-on web development experience (portfolio or past projects)',
      'Prior teaching, training, or mentoring experience preferred',
      'Comfortable explaining technical concepts to beginners',
      'Available for in-person classes at a TITAN campus',
    ],
    resumeRequired: true,
  },
  {
    title: 'Digital Marketing Trainer',
    jobType: 'part_time',
    experience: '2+ years',
    qualification: 'BBA/MBA (Marketing) or equivalent practical experience',
    about: 'Deliver our Digital Marketing course — SEO, social media, paid ads, and analytics — to evening batches.',
    subjectCommand: 'Digital Marketing (SEO, SEM, Social Media Marketing, Analytics)',
    skills: ['SEO', 'Google Ads', 'Social Media Marketing', 'Analytics', 'Content Strategy'],
    expectedSalary: 'PKR 40,000 - 60,000',
    languages: ['English', 'Urdu'],
    description:
      'We are hiring a part-time Digital Marketing trainer for our evening batches. You will run practical, campaign-based sessions covering SEO, paid advertising, social media, and analytics, and guide students through a real campaign as part of the course.',
    requirements: [
      'Demonstrable experience running real digital marketing campaigns',
      'Comfortable teaching evening classes (2-3 sessions/week)',
      'Up to date with current SEO/social/ads platform practices',
    ],
    resumeRequired: true,
  },
  {
    title: 'Graphic Design Trainer',
    jobType: 'full_time',
    experience: '3+ years',
    qualification: 'Degree/diploma in Graphic Design, Fine Arts, or a related field',
    about: 'Teach our Graphic Designing course — typography, layout, branding, and industry-standard design tools.',
    subjectCommand: 'Graphic Designing (Adobe Photoshop, Illustrator, branding, typography)',
    skills: ['Adobe Photoshop', 'Adobe Illustrator', 'Typography', 'Branding', 'Layout Design'],
    expectedSalary: 'PKR 60,000 - 90,000',
    languages: ['English', 'Urdu'],
    description:
      'Looking for a creative, patient trainer to lead our Graphic Designing course cohorts. You will run studio-style sessions, give portfolio feedback, and help students build a body of work they can show employers or clients by the end of the course.',
    requirements: [
      'A strong personal design portfolio',
      'Prior teaching/mentoring experience preferred',
      'Fluent in Adobe Photoshop and Illustrator',
    ],
    resumeRequired: true,
  },
  {
    title: 'Admissions & Front Desk Officer',
    jobType: 'full_time',
    experience: '1+ years',
    qualification: 'Bachelor’s degree (any discipline)',
    about: 'Be the first point of contact for prospective students visiting or calling a TITAN campus.',
    subjectCommand: 'Front Desk / Admissions Coordination',
    skills: ['Customer Service', 'MS Office', 'Communication', 'Record Keeping'],
    expectedSalary: 'PKR 35,000 - 45,000',
    languages: ['English', 'Urdu'],
    description:
      'We’re hiring a front desk / admissions officer to manage campus walk-ins, phone and email inquiries about our courses, guide prospective students through registration, and keep admissions records up to date alongside the campus administration team.',
    requirements: [
      'Excellent verbal and written communication skills',
      'Comfortable with day-to-day computer/office work',
      'Prior front-desk, admissions, or customer service experience is a plus',
    ],
    resumeRequired: false,
  },
  {
    title: 'IT Support Officer',
    jobType: 'full_time',
    experience: '1-2 years',
    qualification: 'BS in Computer Science/IT or equivalent experience',
    about: 'Keep classroom labs, campus networks, and student portal access running smoothly across a TITAN campus.',
    subjectCommand: 'IT Support (Windows/Linux, networking, helpdesk)',
    skills: ['Windows/Linux Administration', 'Networking', 'Helpdesk Support', 'Hardware Troubleshooting'],
    expectedSalary: 'PKR 45,000 - 65,000',
    languages: ['English', 'Urdu'],
    description:
      'Support our campus’s day-to-day IT needs: lab computers, classroom AV equipment, campus network/Wi-Fi, and first-line troubleshooting for staff and students using the Student/Trainer Portal.',
    requirements: [
      'Solid troubleshooting skills across common OS/hardware/network issues',
      'Comfortable supporting non-technical staff and students',
      'Available for on-site campus work',
    ],
    resumeRequired: true,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const seedJobs = async () => {
  const existingCount = await Job.countDocuments();
  if (existingCount > 0) {
    return { created: 0, note: 'jobs already exist — skipped' };
  }

  const superAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });
  if (!superAdmin) {
    return { created: 0, note: 'no Super Admin account found to attribute jobs to — skipped' };
  }

  const now = new Date();
  const openingDate = new Date(now.getTime() - 3 * DAY_MS);
  const closingDate = new Date(now.getTime() + 45 * DAY_MS);

  let created = 0;
  for (const def of JOB_DEFS) {
    // eslint-disable-next-line no-await-in-loop
    await Job.create({
      ...def,
      links: [],
      openingDate,
      closingDate,
      status: 'open',
      createdBy: superAdmin._id,
      updatedBy: superAdmin._id,
    });
    created += 1;
  }

  return { created };
};

const run = async () => {
  await connectDB();
  const courseSummary = await seedCourseDescriptions();
  const jobSummary = await seedJobs();
  console.log('Public course/registration + careers content seed summary (safe to re-run):');
  console.log({ courseDescriptions: courseSummary, jobs: jobSummary });
  await mongoose.connection.close();
  process.exit(0);
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seedCourseDescriptions, seedJobs };
