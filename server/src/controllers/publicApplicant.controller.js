const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Applicant = require('../models/Applicant');
const { ROLES } = require('../utils/constants');

// Public (unauthenticated) Applicant account creation — the "Create
// Applicant Account" side of the Apply Now flow. Deliberately its own
// isolated file (not appended to public.controller.js/publicJob.controller.js)
// and deliberately does NOT mint a session token itself: account creation
// and session creation stay two separate concerns, with the existing
// POST /api/auth/login remaining the one and only place a JWT is ever
// issued for ANY role, applicants included — no second auth system.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc    Create a new Applicant account (User + Applicant). Role is
//          ALWAYS 'APPLICANT' — never read from the request body, so a
//          caller can never mass-assign themselves a different role.
// @route   POST /api/public/applicant/register
// @access  Public
const registerApplicant = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Name is required');
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400);
    throw new Error('Please provide a valid email address');
  }
  if (!password || String(password).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(409);
    throw new Error(
      existing.role === ROLES.APPLICANT
        ? 'An account with this email already exists. Please log in instead.'
        : 'This email is already associated with an account. Please use a different email address.'
    );
  }

  // Only name/email/password are ever used to build the account — `role`
  // is hardcoded, never taken from req.body, so it can't be mass-assigned.
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password,
    role: ROLES.APPLICANT,
  });
  await Applicant.create({ user: user._id });

  res.status(201).json({
    success: true,
    message: 'Account created. Please log in to continue.',
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

module.exports = { registerApplicant };
