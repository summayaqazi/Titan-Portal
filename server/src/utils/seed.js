require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('./constants');
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

const run = async () => {
  await connectDB();

  await seedSuperAdmin();

  const summary = await seedDemoData();
  console.log('Demo data seeded (safe to re-run, existing records are updated in place):');
  console.log(summary);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
