const asyncHandler = require('express-async-handler');
const Role = require('../models/Role');
const User = require('../models/User');
const { ROLES, PERMISSION_MODULES, PERMISSION_ACTIONS } = require('../utils/constants');

// @desc    Count of users per role (backs the Roles & Permissions overview)
// @route   GET /api/roles/summary
const getRoleSummary = asyncHandler(async (req, res) => {
  const counts = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  const countByRole = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  const data = Object.values(ROLES).map((role) => ({ role, count: countByRole[role] || 0 }));

  res.json({ success: true, data });
});

// @desc    List all roles with their permission matrix and live user counts
// @route   GET /api/roles
const getRoles = asyncHandler(async (req, res) => {
  const [roles, counts] = await Promise.all([
    Role.find().sort({ isSystem: -1, name: 1 }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);
  const countByRole = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  res.json({
    success: true,
    data: roles.map((role) => ({ ...role.toObject(), userCount: countByRole[role.name] || 0 })),
  });
});

const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }
  res.json({ success: true, data: role });
});

const normalizePermissions = (permissions = []) =>
  PERMISSION_MODULES.map((module) => {
    const entry = permissions.find((p) => p.module === module) || {};
    const normalized = { module };
    PERMISSION_ACTIONS.forEach((action) => {
      normalized[action] = Boolean(entry[action]);
    });
    return normalized;
  });

const createRole = asyncHandler(async (req, res) => {
  const { name, label, description, permissions } = req.body;

  if (!name || !label) {
    res.status(400);
    throw new Error('Role name and label are required');
  }

  const existing = await Role.findOne({ name: name.trim().toUpperCase() });
  if (existing) {
    res.status(400);
    throw new Error('A role with this name already exists');
  }

  const role = await Role.create({
    name: name.trim().toUpperCase(),
    label,
    description,
    isSystem: false,
    permissions: normalizePermissions(permissions),
  });

  res.status(201).json({ success: true, data: role });
});

const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }
  if (role.isSystem) {
    res.status(400);
    throw new Error('The Super Admin system role cannot be modified');
  }

  const { label, description, permissions } = req.body;
  if (label !== undefined) role.label = label;
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) role.permissions = normalizePermissions(permissions);

  await role.save();
  res.json({ success: true, data: role });
});

const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }
  if (role.isSystem) {
    res.status(400);
    throw new Error('The Super Admin system role cannot be deleted');
  }

  const inUseCount = await User.countDocuments({ role: role.name });
  if (inUseCount > 0) {
    res.status(400);
    throw new Error(`Cannot delete a role assigned to ${inUseCount} user(s)`);
  }

  await role.deleteOne();
  res.json({ success: true, message: 'Role deleted' });
});

module.exports = { getRoleSummary, getRoles, getRole, createRole, updateRole, deleteRole };
