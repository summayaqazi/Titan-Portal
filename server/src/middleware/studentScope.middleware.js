const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');

// Resolves the logged-in STUDENT's own Student document once per request
// and stashes it on req.student, for every Student-portal route to use —
// never derived from anything client-supplied. Exact same pattern as
// trainerScope.middleware.js's attachOwnTrainer.
const attachOwnStudent = asyncHandler(async (req, res, next) => {
  const student = await Student.findOne({ user: req.user._id });
  if (!student) {
    res.status(404);
    throw new Error('No student profile found for this account');
  }
  req.student = student;
  next();
});

module.exports = { attachOwnStudent };
