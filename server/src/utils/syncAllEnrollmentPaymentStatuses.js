// One-off backfill: brings every existing Enrollment.paymentStatus in sync
// with its actual Payment records, right now — needed because the bug this
// fixes let them drift silently for as long as the app has been running
// (Enrollment.paymentStatus previously had no write path tied to Payment
// changes at all; see payment.controller.js#syncEnrollmentPaymentStatus's
// own comment for the full root-cause explanation). Without this, the code
// fix alone only prevents *future* drift — any enrollment already stale
// right now would stay stale until its next Payment mutation, which could
// be never. Idempotent/safe to re-run (a no-op for anything already
// correct); reuses the exact same aggregation function every real Payment
// write now calls, never a second implementation.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Enrollment = require('../models/Enrollment');
const { syncEnrollmentPaymentStatus } = require('../controllers/payment.controller');

const run = async () => {
  await connectDB();

  const enrollments = await Enrollment.find({}).select('_id paymentStatus');
  console.log(`Checking ${enrollments.length} enrollment(s)...`);

  let changed = 0;
  for (const enrollment of enrollments) {
    const before = enrollment.paymentStatus;
    // eslint-disable-next-line no-await-in-loop
    await syncEnrollmentPaymentStatus(enrollment._id);
    // eslint-disable-next-line no-await-in-loop
    const after = await Enrollment.findById(enrollment._id).select('paymentStatus');
    if (after.paymentStatus !== before) {
      changed += 1;
      console.log(`  ${enrollment._id}: ${before} -> ${after.paymentStatus}`);
    }
  }

  console.log(changed ? `Done — corrected ${changed} enrollment(s).` : 'Done — everything was already in sync.');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
