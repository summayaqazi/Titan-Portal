// Restores ONLY the RBAC layer (the `roles` collection) — reuses
// seedRoles()/DEFAULT_ROLES from seed.js rather than duplicating the
// permission matrix. Does not touch users, students, trainers, courses,
// campuses, enrollments, or any other collection.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { seedRoles } = require('./seed');

const run = async () => {
  await connectDB();
  await seedRoles();
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
