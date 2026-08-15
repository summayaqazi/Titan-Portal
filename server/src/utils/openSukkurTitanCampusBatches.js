// One-off, additive-only data fix: makes the real, already-existing Sukkur
// Titan Campus batches for Modern Web And App Development, Graphic
// Designing, and Web Development eligible for the public Courses/
// Registration page.
//
// Root cause (confirmed by inspecting the actual data, not guessed): the
// public Courses API (server/src/controllers/public.controller.js) was
// never broken — it correctly lists a course once it has at least one Batch
// with `registrationOpen: true` AND `status` in ['upcoming', 'ongoing'].
// Web Development's Sukkur batch (WEBDEV-B4) already satisfies that and was
// already showing up publicly. Modern Web And App Development's only batch
// (MODWEB) and Graphic Designing's Sukkur batch (GRAPHDS) are both real,
// already-created batches at the real Sukkur Titan Campus, with real
// trainers/slots assigned — they just still had `registrationOpen: false`,
// so the (correct, unchanged) filter was rightly excluding them.
//
// This sets `registrationOpen: true` on ONLY those specific, already-real
// batches — matched by batchCode + campus, never created — and touches
// NO other field (course/campus/trainer/slot/dates/capacity/status all
// stay exactly as already entered). Idempotent: a batch already open is
// left alone and reported separately, so re-running this is always safe.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Batch = require('../models/Batch');
const Campus = require('../models/Campus');
require('../models/Course'); // registers the Course schema for .populate('course')

const CAMPUS_NAME = 'Sukkur Titan Campus';
// The exact real batches this campus already has for these 3 courses
// (confirmed via a direct read of the live database before writing this
// script) — not a guess, not a new record.
const TARGET_BATCH_CODES = ['MODWEB', 'GRAPHDS', 'WEBDEV-B4'];

const openSukkurBatches = async () => {
  const campus = await Campus.findOne({ name: CAMPUS_NAME });
  if (!campus) {
    return { opened: [], alreadyOpen: [], note: `Campus "${CAMPUS_NAME}" not found — nothing changed` };
  }

  const batches = await Batch.find({ campus: campus._id, batchCode: { $in: TARGET_BATCH_CODES } }).populate(
    'course',
    'name'
  );

  const opened = [];
  const alreadyOpen = [];

  for (const batch of batches) {
    if (batch.registrationOpen) {
      alreadyOpen.push({ batchCode: batch.batchCode, course: batch.course?.name });
      continue;
    }
    batch.registrationOpen = true;
    // eslint-disable-next-line no-await-in-loop
    await batch.save();
    opened.push({ batchCode: batch.batchCode, course: batch.course?.name, status: batch.status });
  }

  const foundCodes = batches.map((b) => b.batchCode);
  const missing = TARGET_BATCH_CODES.filter((code) => !foundCodes.includes(code));

  return { opened, alreadyOpen, missing };
};

const run = async () => {
  await connectDB();
  const summary = await openSukkurBatches();
  console.log('Sukkur Titan Campus public-registration fix summary (safe to re-run):');
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.connection.close();
  process.exit(0);
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { openSukkurBatches };
