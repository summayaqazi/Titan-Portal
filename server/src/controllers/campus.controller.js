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

const createCampus = asyncHandler(async (req, res) => {
  const { name, city, address, contactNumber, isActive } = req.body;

  if (!name || !city) {
    res.status(400);
    throw new Error('Campus name and city are required');
  }

  const cityExists = await City.findById(city);
  if (!cityExists) {
    res.status(400);
    throw new Error('Selected city does not exist');
  }

  const campus = await Campus.create({ name, city, address, contactNumber, isActive });
  res.status(201).json({ success: true, data: await campus.populate('city', 'name') });
});

const updateCampus = asyncHandler(async (req, res) => {
  const campus = await Campus.findById(req.params.id);
  if (!campus) {
    res.status(404);
    throw new Error('Campus not found');
  }

  const { name, city, address, contactNumber, isActive } = req.body;

  if (city !== undefined) {
    const cityExists = await City.findById(city);
    if (!cityExists) {
      res.status(400);
      throw new Error('Selected city does not exist');
    }
    campus.city = city;
  }
  if (name !== undefined) campus.name = name;
  if (address !== undefined) campus.address = address;
  if (contactNumber !== undefined) campus.contactNumber = contactNumber;
  if (isActive !== undefined) campus.isActive = isActive;

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
