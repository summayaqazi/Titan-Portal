// Restores ONLY the default Campus Admin account if it's missing — reuses
// seedDemoAdmin() from seed.js (already idempotent: creates only if an
// account with that email doesn't exist) rather than duplicating it. Does
// not touch the Super Admin account, roles, or any other collection.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { seedDemoAdmin } = require('./seed');

const run = async () => {
  await connectDB();
  await seedDemoAdmin();
  await mongoose.connection.close();
  process.exit(0);
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seedDemoAdmin };
