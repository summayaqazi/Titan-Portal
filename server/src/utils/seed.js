require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('./constants');

const seedSuperAdmin = async () => {
  await connectDB();

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

  await mongoose.connection.close();
  process.exit(0);
};

seedSuperAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
