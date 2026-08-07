const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Role = require('../models/Role');
const Trainer = require('../models/Trainer');
const generateToken = require('../utils/generateToken');
const { ROLES, PERMISSION_MODULES, PERMISSION_ACTIONS } = require('../utils/constants');
const { toTrainerProfile } = require('../utils/trainerProfile');

// Resolves a role name into a { module: { view, create, update, delete, export } }
// map. SUPER_ADMIN always gets every permission, even if its Role document is
// somehow missing, so the app can never lock itself out.
const resolvePermissions = async (roleName) => {
  if (roleName === ROLES.SUPER_ADMIN) {
    return Object.fromEntries(
      PERMISSION_MODULES.map((module) => [
        module,
        Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, true])),
      ])
    );
  }

  const role = await Role.findOne({ name: roleName });
  return Object.fromEntries(
    PERMISSION_MODULES.map((module) => {
      const entry = role?.permissions.find((p) => p.module === module);
      return [module, Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, Boolean(entry?.[action])]))];
    })
  );
};

// Trainer portal's profile data (Employee ID, hourly rate, bio, social
// links, ...) lives on the Trainer collection, not User — this makes it
// available for free via the existing login/getMe flow instead of a
// separate fetch. Undefined (so it's dropped by JSON.stringify, not sent at
// all) for every role but TRAINER — zero response-shape change for anyone
// else.
const resolveTrainerProfile = async (user) => {
  if (user.role !== ROLES.TRAINER) return undefined;
  const trainer = await Trainer.findOne({ user: user._id })
    .populate('campuses', 'name')
    .populate('courses', 'name code');
  return trainer ? toTrainerProfile(trainer) : null;
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated');
  }

  user.lastLogin = new Date();
  await user.save();
  await user.populate({ path: 'campus', populate: { path: 'city' } });

  const token = generateToken(user._id, user.role);
  const permissions = await resolvePermissions(user.role);
  const trainerProfile = await resolveTrainerProfile(user);

  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      campus: user.campus,
      permissions,
      trainerProfile,
    },
  });
});

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  await req.user.populate({ path: 'campus', populate: { path: 'city' } });
  const permissions = await resolvePermissions(req.user.role);
  const trainerProfile = await resolveTrainerProfile(req.user);
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      phone: req.user.phone,
      avatar: req.user.avatar,
      campus: req.user.campus,
      permissions,
      trainerProfile,
    },
  });
});

// @desc    Update current logged-in user's profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (req.file) {
    if (user.avatar) {
      const oldPath = path.join(__dirname, '..', user.avatar.replace('/uploads/', 'uploads/'));
      fs.unlink(oldPath, () => {});
    }
    user.avatar = `/uploads/${req.file.filename}`;
  } else if (req.body.removeAvatar === 'true' && user.avatar) {
    const oldPath = path.join(__dirname, '..', user.avatar.replace('/uploads/', 'uploads/'));
    fs.unlink(oldPath, () => {});
    user.avatar = undefined;
  }

  await user.save();

  res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
    },
  });
});

// @desc    Change current logged-in user's password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current password and new password are required');
  }
  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    res.status(400);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = { login, getMe, updateProfile, changePassword };
