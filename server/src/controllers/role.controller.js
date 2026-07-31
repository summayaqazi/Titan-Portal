const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { ROLES } = require('../utils/constants');

// @desc    Count of users per role (backs the Roles & Permissions overview)
// @route   GET /api/roles/summary
const getRoleSummary = asyncHandler(async (req, res) => {
  const counts = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  const countByRole = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  const data = Object.values(ROLES).map((role) => ({ role, count: countByRole[role] || 0 }));

  res.json({ success: true, data });
});

module.exports = { getRoleSummary };
