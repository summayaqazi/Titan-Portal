const mongoose = require('mongoose');
const Campus = require('../models/Campus');

// Resolves a campus id — the campus currently selected on the Admin
// Portal's Campus Selector, already picked out of req.query/req.body by
// the caller — into the Mongo filter that finds every Job belonging to
// that campus OR that campus's city. Reads the actual Campus -> City
// relationship from MongoDB (Campus.city ref -> City.name) on every call,
// never a hardcoded city name, so it always reflects whatever the
// database currently has. Shared by job.controller.js's own job list/
// detail scoping and dashboard.controller.js's Job Applications stat, so
// the two can never drift into scoping jobs differently from one another.
//
// Job.city is free text and, in real data, sometimes a comma-separated
// list (e.g. a job posted for "Karachi, Faisalabad") rather than always a
// single city — matched as one token of that list (comma- or
// start/end-anchored), not a full-string match, so a multi-city posting
// still reaches every city it names. Escaped before it lands in $regex —
// a city name is Super-Admin-entered free text (via the City model), not
// necessarily safe as a literal regex pattern.
//
// Returns null when campusId is missing, not a valid ObjectId, or doesn't
// resolve to a real Campus — the caller is responsible for turning that
// into a "matches nothing" sentinel filter, consistent with how every
// other Admin-scoped query in this app denies by default rather than ever
// falling through to global/unscoped data.
const buildJobCampusCityFilter = async (campusId) => {
  if (!campusId || !mongoose.Types.ObjectId.isValid(campusId)) return null;

  const campus = await Campus.findById(campusId).populate('city', 'name');
  if (!campus) return null;

  const scope = [{ campus: campus._id }];
  if (campus.city?.name) {
    const escapedCity = campus.city.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    scope.push({ city: new RegExp(`(^|,)\\s*${escapedCity}\\s*(,|$)`, 'i') });
  }
  return { $or: scope };
};

module.exports = { buildJobCampusCityFilter };
