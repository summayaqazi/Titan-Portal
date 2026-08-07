// Repairs ONLY broken Trainer relationships (campuses / courses / hourlyRate)
// left over from the database restore. Never creates a Trainer, Campus, or
// Course, and never touches a trainer whose campuses/courses are already
// populated — manually entered data is left exactly as-is. Manual,
// idempotent (safe to re-run: already-correct trainers are skipped).
//
// Recovery sources, in order of authority:
//  1. Batch documents (trainer -> course, trainer -> campus) — the real,
//     intact relationship data. A trainer teaching batches at N campuses
//     gets all N in `campuses`; same for courses.
//  2. A stale singular `campus` field left on some Trainer documents by an
//     older schema version (current schema uses `campuses`, an array) —
//     used only as a campus fallback when no batches exist for that trainer.
//  3. hourlyRate has no relationship to recover it from. It's only restored
//     for the known demo trainers (trainer1@titan.com..trainer6@titan.com,
//     identifiable via their still-intact User.email), using the exact
//     `1500 + index*100` formula seedDemoData.js already seeds them with.
//     A trainer that doesn't match this pattern is left untouched — never
//     guessed — so manually entered data is never overwritten.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Trainer = require('../models/Trainer');
const Batch = require('../models/Batch');
const User = require('../models/User');

const DEMO_TRAINER_EMAIL_RE = /^trainer(\d+)@titan\.com$/;

const repairTrainers = async () => {
  // Raw native-driver read so an old, no-longer-in-schema `campus` field
  // (Mongoose silently drops unknown fields on hydration) is still visible.
  const rawTrainers = await mongoose.connection.db.collection('trainers').find({}).toArray();

  let campusesRepaired = 0;
  let coursesRepaired = 0;
  let hourlyRateRecovered = 0;
  let untouched = 0;

  for (const raw of rawTrainers) {
    // eslint-disable-next-line no-await-in-loop
    const trainer = await Trainer.findById(raw._id);
    if (!trainer) continue;

    // eslint-disable-next-line no-await-in-loop
    const batches = await Batch.find({ trainer: trainer._id });
    const batchCampusIds = [...new Set(batches.map((b) => b.campus?.toString()).filter(Boolean))];
    const batchCourseIds = [...new Set(batches.map((b) => b.course?.toString()).filter(Boolean))];

    let changed = false;

    const hasCampuses = Array.isArray(raw.campuses) && raw.campuses.length > 0;
    if (!hasCampuses) {
      let recovered = batchCampusIds;
      if (recovered.length === 0 && raw.campus) recovered = [raw.campus.toString()];
      if (recovered.length > 0) {
        trainer.campuses = recovered;
        changed = true;
        campusesRepaired += 1;
      }
    }

    const hasCourses = Array.isArray(raw.courses) && raw.courses.length > 0;
    if (!hasCourses && batchCourseIds.length > 0) {
      trainer.courses = batchCourseIds;
      changed = true;
      coursesRepaired += 1;
    }

    if (trainer.hourlyRate === undefined || trainer.hourlyRate === null) {
      // eslint-disable-next-line no-await-in-loop
      const user = await User.findById(trainer.user).select('email');
      const match = user?.email?.match(DEMO_TRAINER_EMAIL_RE);
      if (match) {
        const index = parseInt(match[1], 10) - 1;
        trainer.hourlyRate = 1500 + index * 100;
        changed = true;
        hourlyRateRecovered += 1;
      }
    }

    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await trainer.save();
    } else {
      untouched += 1;
    }
  }

  return { total: rawTrainers.length, campusesRepaired, coursesRepaired, hourlyRateRecovered, untouched };
};

const run = async () => {
  await connectDB();
  const summary = await repairTrainers();
  console.log('Trainer relationship repair summary (safe to re-run):');
  console.log(summary);
  await mongoose.connection.close();
  process.exit(0);
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { repairTrainers };
