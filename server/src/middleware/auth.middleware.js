const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Role = require('../models/Role');
const { ROLES } = require('../utils/constants');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      res.status(401);
      throw new Error('Not authorized, user not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, token invalid or expired');
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Forbidden: insufficient permissions for this action');
    }
    next();
  };
};

// SUPER_ADMIN always bypasses permission checks (its Role doc is a protected,
// always-all-true system role) so a missing/misseeded Role document can never
// lock out the only account able to log in today. Resolution is lazy and
// per-request (no cache) so edits made on the Roles & Permissions page take
// effect immediately.
const checkPermission = (module, action) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized');
    }
    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    const role = await Role.findOne({ name: req.user.role });
    if (!role || !role.can(module, action)) {
      res.status(403);
      throw new Error('Forbidden: insufficient permissions for this action');
    }
    next();
  });

module.exports = { protect, authorize, checkPermission };
