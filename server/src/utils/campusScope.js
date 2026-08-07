const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const { ROLES } = require('./constants');

// Resolves a `campus` filter (the Admin Portal's Campus Selector) into a
// `batch` filter value, for models that reference `batch` but have no
// direct `campus` field of their own (Attendance, TrainerAttendance).
// Composes with an already-set `batch` filter (intersection) instead of
// one silently overriding the other, so a page's own batch filter and the
// campus scope both apply correctly together.
const scopeBatchFilterToCampus = async (campus, existingBatchFilter) => {
  if (!campus) return existingBatchFilter;

  const campusBatchIds = await Batch.distinct('_id', { campus });
  if (!existingBatchFilter) return { $in: campusBatchIds };

  const campusBatchIdStrings = new Set(campusBatchIds.map((id) => id.toString()));
  const requested = Array.isArray(existingBatchFilter) ? existingBatchFilter : [existingBatchFilter];
  return { $in: requested.filter((id) => campusBatchIdStrings.has(id.toString())) };
};

// Every list/detail endpoint reachable from the Admin Portal must never mix
// or leak another campus's data — not just when the client remembers to
// send `?campus=`. For ADMIN, this always returns a campus id to filter by:
// the requested one if valid, otherwise a sentinel id that matches no real
// document (so the endpoint reads zero instead of silently falling through
// to unscoped/global data). Returns undefined for any other role, so
// Super Admin — including its own pre-existing, unrelated `campus` filters
// (e.g. the Trainers page) — is completely unaffected.
const requireAdminCampusScope = (req) => {
  if (req.user.role !== ROLES.ADMIN) return undefined;
  // Checks both — GET endpoints send it as a query param, POST endpoints
  // (e.g. Multi Attendance) send it in the body.
  const requested = req.query.campus || req.body?.campus;
  if (requested && mongoose.Types.ObjectId.isValid(requested)) {
    return requested;
  }
  return new mongoose.Types.ObjectId().toString();
};

module.exports = { scopeBatchFilterToCampus, requireAdminCampusScope };
