const asyncHandler = require('express-async-handler');
const Campus = require('../models/Campus');
const City = require('../models/City');
const Batch = require('../models/Batch');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const getCampuses = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (req.query.city) filter.city = req.query.city;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const [items, total] = await Promise.all([
    Campus.find(filter).populate('city', 'name').sort({ name: 1 }).skip(skip).limit(limit),
    Campus.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const getCampus = asyncHandler(async (req, res) => {
  const campus = await Campus.findById(req.params.id).populate('city', 'name');
  if (!campus) {
    res.status(404);
    throw new Error('Campus not found');
  }
  res.json({ success: true, data: campus });
});

// Accepts optional lat/lng (either as a nested `location: { lat, lng }` or
// flat `latitude`/`longitude`, whichever the form sends) plus an optional
// `attendanceRadiusMeters` — added for Trainer Face + Location Attendance's
// geofence check. `undefined`/blank values are simply omitted so a campus
// can still be created/edited with coordinates left unset, same as before
// this feature existed.
const parseLocation = (body) => {
  const lat = body.location?.lat ?? body.latitude;
  const lng = body.location?.lng ?? body.longitude;
  if (lat === undefined && lng === undefined) return undefined;
  const parsedLat = lat === '' || lat == null ? undefined : Number(lat);
  const parsedLng = lng === '' || lng == null ? undefined : Number(lng);
  if (parsedLat === undefined && parsedLng === undefined) return undefined;
  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
    const err = new Error('Latitude and longitude must both be valid numbers');
    err.status = 400;
    throw err;
  }
  return { lat: parsedLat, lng: parsedLng };
};

const createCampus = asyncHandler(async (req, res) => {
  const { name, city, address, contactNumber, isActive, attendanceRadiusMeters } = req.body;

  if (!name || !city) {
    res.status(400);
    throw new Error('Campus name and city are required');
  }

  const cityExists = await City.findById(city);
  if (!cityExists) {
    res.status(400);
    throw new Error('Selected city does not exist');
  }

  const existing = await Campus.findOne({ name });
  if (existing) {
    res.status(400);
    throw new Error('A campus with this name already exists');
  }

  let location;
  try {
    location = parseLocation(req.body);
  } catch (err) {
    res.status(err.status || 400);
    throw err;
  }

  const campus = await Campus.create({
    name,
    city,
    address,
    contactNumber,
    isActive,
    location,
    attendanceRadiusMeters: attendanceRadiusMeters === '' || attendanceRadiusMeters == null ? undefined : Number(attendanceRadiusMeters),
  });
  res.status(201).json({ success: true, data: await campus.populate('city', 'name') });
});

const updateCampus = asyncHandler(async (req, res) => {
  const campus = await Campus.findById(req.params.id);
  if (!campus) {
    res.status(404);
    throw new Error('Campus not found');
  }

  const { name, city, address, contactNumber, isActive, attendanceRadiusMeters } = req.body;

  if (city !== undefined) {
    const cityExists = await City.findById(city);
    if (!cityExists) {
      res.status(400);
      throw new Error('Selected city does not exist');
    }
    campus.city = city;
  }
  if (name !== undefined && name !== campus.name) {
    const existing = await Campus.findOne({ name });
    if (existing) {
      res.status(400);
      throw new Error('A campus with this name already exists');
    }
    campus.name = name;
  }
  if (address !== undefined) campus.address = address;
  if (contactNumber !== undefined) campus.contactNumber = contactNumber;
  if (isActive !== undefined) campus.isActive = isActive;

  let location;
  try {
    location = parseLocation(req.body);
  } catch (err) {
    res.status(err.status || 400);
    throw err;
  }
  if (location !== undefined) campus.location = location;
  if (attendanceRadiusMeters !== undefined && attendanceRadiusMeters !== '') {
    campus.attendanceRadiusMeters = Number(attendanceRadiusMeters);
  }

  await campus.save();
  res.json({ success: true, data: await campus.populate('city', 'name') });
});

const deleteCampus = asyncHandler(async (req, res) => {
  const campus = await Campus.findById(req.params.id);
  if (!campus) {
    res.status(404);
    throw new Error('Campus not found');
  }

  const batchCount = await Batch.countDocuments({ campus: campus._id });
  if (batchCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a campus that has batches assigned to it');
  }

  await campus.deleteOne();
  res.json({ success: true, message: 'Campus deleted' });
});

module.exports = { getCampuses, getCampus, createCampus, updateCampus, deleteCampus };
