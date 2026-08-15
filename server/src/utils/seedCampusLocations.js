// One-off, additive-only data fix: populates `location.lat/lng` and
// `attendanceRadiusMeters` (see models/Campus.js) for every real,
// already-existing Campus document that doesn't have coordinates set yet —
// this is what was actually missing (confirmed by reading the live
// database directly, not guessed) and is why Trainer Face + Location
// Attendance was showing "Your campus location isn't configured yet" for
// every campus, Sukkur included. No campus is special-cased in the
// verification code (trainerSelfAttendance.controller.js already reads
// whichever campus the trainer's current batch actually belongs to,
// generically, straight from MongoDB) — this script just backfills the
// data every campus was missing, the same way openSukkurTitanCampusBatches.js
// backfilled a different, already-real gap for the same campus record.
//
// Coordinates below are real-world, area-level (city/neighborhood-center)
// estimates for each campus's own already-stored city/address — the best
// available without a street-level geocoding service. They are a starting
// point, not a survey-grade pin: a Super Admin should open each campus in
// the existing Add/Edit Campus form (client/src/pages/superadmin/
// Campuses.jsx) and refine Latitude/Longitude to the exact building using
// a maps app, any time after this runs. Radius defaults to 200m (this
// schema's own existing default — see models/Campus.js) for every campus,
// deliberately loose to tolerate that area-level starting accuracy; tighten
// per-campus once a precise pin is set.
//
// Idempotent/safe to re-run: a campus that already has BOTH lat and lng set
// (whether by this script before, or by a Super Admin since) is left
// completely untouched — this never overwrites a real, already-configured
// value.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Campus = require('../models/Campus');

// name -> { lat, lng } — matched by the campus's own existing `name` field,
// never created. Any real campus not listed here (or added after this
// script was written) simply isn't touched; nothing about the verification
// logic depends on this list.
const CAMPUS_LOCATIONS = {
  'Karachi Main Campus': { lat: 24.8546, lng: 67.0641 }, // Shahrah-e-Faisal, Karachi
  'Karachi North Campus': { lat: 24.9342, lng: 67.0402 }, // North Nazimabad, Karachi
  'Lahore Gulberg Campus': { lat: 31.5092, lng: 74.3433 }, // Gulberg III, Lahore
  'Islamabad Blue Area Campus': { lat: 33.7089, lng: 73.0678 }, // Blue Area, Islamabad
  'Faisalabad Campus': { lat: 31.418, lng: 73.085 }, // Susan Road, Faisalabad
  'Sukkur Titan Campus': { lat: 27.7052, lng: 68.8574 }, // Military Road, Sukkur
};
const DEFAULT_RADIUS_METERS = 200;

const run = async () => {
  await connectDB();

  const updated = [];
  const skippedAlreadySet = [];
  const skippedNotFound = [];

  for (const [name, location] of Object.entries(CAMPUS_LOCATIONS)) {
    // eslint-disable-next-line no-await-in-loop
    const campus = await Campus.findOne({ name });
    if (!campus) {
      skippedNotFound.push(name);
      continue;
    }
    if (campus.location?.lat != null && campus.location?.lng != null) {
      skippedAlreadySet.push({ name, location: campus.location });
      continue;
    }
    campus.location = location;
    if (campus.attendanceRadiusMeters == null) campus.attendanceRadiusMeters = DEFAULT_RADIUS_METERS;
    // eslint-disable-next-line no-await-in-loop
    await campus.save();
    updated.push({ name, location, attendanceRadiusMeters: campus.attendanceRadiusMeters });
  }

  console.log('Updated:', JSON.stringify(updated, null, 2));
  if (skippedAlreadySet.length) console.log('Already configured (left untouched):', JSON.stringify(skippedAlreadySet, null, 2));
  if (skippedNotFound.length) console.log('Not found in DB (nothing to do):', skippedNotFound);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
