const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { ROLES } = require('../utils/constants');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

const getAdminUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = { role: { $in: ADMIN_ROLES } };
  if (req.query.role && ADMIN_ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (search) {
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const createAdminUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !role || !ADMIN_ROLES.includes(role)) {
    res.status(400);
    throw new Error('Name, email and a valid role (ADMIN or SUPER_ADMIN) are required');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const user = await User.create({ name, email, password: password || 'Admin123', phone, role });
  res.status(201).json({ success: true, data: user });
});

const updateAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    res.status(404);
    throw new Error('Admin user not found');
  }

  const { name, email, phone, role, isActive } = req.body;

  if (email !== undefined && email !== user.email) {
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400);
      throw new Error('A user with this email already exists');
    }
    user.email = email;
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = isActive;

  if (role !== undefined && role !== user.role) {
    if (!ADMIN_ROLES.includes(role)) {
      res.status(400);
      throw new Error('Invalid role');
    }
    if (user.role === ROLES.SUPER_ADMIN && role !== ROLES.SUPER_ADMIN) {
      const superAdminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN });
      if (superAdminCount <= 1) {
        res.status(400);
        throw new Error('Cannot change the role of the last remaining Super Admin');
      }
    }
    user.role = role;
  }

  await user.save();
  res.json({ success: true, data: user });
});

const deleteAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    res.status(404);
    throw new Error('Admin user not found');
  }

  if (user._id.equals(req.user._id)) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }

  if (user.role === ROLES.SUPER_ADMIN) {
    const superAdminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN });
    if (superAdminCount <= 1) {
      res.status(400);
      throw new Error('Cannot delete the last remaining Super Admin');
    }
  }

  await user.deleteOne();
  res.json({ success: true, message: 'Admin user deleted' });
});

module.exports = { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser };
