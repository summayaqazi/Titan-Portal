const asyncHandler = require('express-async-handler');
const City = require('../models/City');
const Campus = require('../models/Campus');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const getCities = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const [items, total] = await Promise.all([
    City.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    City.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const getCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);
  if (!city) {
    res.status(404);
    throw new Error('City not found');
  }
  res.json({ success: true, data: city });
});

const createCity = asyncHandler(async (req, res) => {
  const { name, province, country, isActive } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('City name is required');
  }

  const existing = await City.findOne({ name });
  if (existing) {
    res.status(400);
    throw new Error('A city with this name already exists');
  }

  const city = await City.create({ name, province, country, isActive });
  res.status(201).json({ success: true, data: city });
});

const updateCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);
  if (!city) {
    res.status(404);
    throw new Error('City not found');
  }

  const { name, province, country, isActive } = req.body;
  if (name !== undefined) city.name = name;
  if (province !== undefined) city.province = province;
  if (country !== undefined) city.country = country;
  if (isActive !== undefined) city.isActive = isActive;

  await city.save();
  res.json({ success: true, data: city });
});

const deleteCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);
  if (!city) {
    res.status(404);
    throw new Error('City not found');
  }

  const campusCount = await Campus.countDocuments({ city: city._id });
  if (campusCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a city that has campuses assigned to it');
  }

  await city.deleteOne();
  res.json({ success: true, message: 'City deleted' });
});

module.exports = { getCities, getCity, createCity, updateCity, deleteCity };
