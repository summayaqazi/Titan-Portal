const asyncHandler = require('express-async-handler');
const Applicant = require('../models/Applicant');

// Resolves the logged-in APPLICANT's own Applicant document once per
// request and stashes it on req.applicant, for every Applicant route to
// use — never derived from anything client-supplied (never req.body.
// applicantId). Exact same pattern as studentScope.middleware.js's
// attachOwnStudent / trainerScope.middleware.js's attachOwnTrainer.
const attachOwnApplicant = asyncHandler(async (req, res, next) => {
  const applicant = await Applicant.findOne({ user: req.user._id });
  if (!applicant) {
    res.status(404);
    throw new Error('No applicant profile found for this account');
  }
  req.applicant = applicant;
  next();
});

module.exports = { attachOwnApplicant };
