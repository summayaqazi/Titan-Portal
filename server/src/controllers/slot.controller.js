const asyncHandler = require('express-async-handler');
const Slot = require('../models/Slot');
const Batch = require('../models/Batch');
const { parseListQuery, paginatedResponse } = require('../utils/queryHelpers');

const getSlots = asyncHandler(async (req, res) => {
  const { page, limit, search, skip } = parseListQuery(req);

  const filter = {};
  if (search) filter.label = { $regex: search, $options: 'i' };
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const [items, total] = await Promise.all([
    Slot.find(filter).sort({ startTime: 1 }).skip(skip).limit(limit),
    Slot.countDocuments(filter),
  ]);

  res.json(paginatedResponse({ items, total, page, limit }));
});

const getSlot = asyncHandler(async (req, res) => {
  const slot = await Slot.findById(req.params.id);
  if (!slot) {
    res.status(404);
    throw new Error('Slot not found');
  }
  res.json({ success: true, data: slot });
});

const createSlot = asyncHandler(async (req, res) => {
  const { label, startTime, endTime, days, isActive } = req.body;

  if (!label || !startTime || !endTime) {
    res.status(400);
    throw new Error('Label, start time and end time are required');
  }

  const existing = await Slot.findOne({ label });
  if (existing) {
    res.status(400);
    throw new Error('A slot with this label already exists');
  }

  const slot = await Slot.create({ label, startTime, endTime, days, isActive });
  res.status(201).json({ success: true, data: slot });
});

const updateSlot = asyncHandler(async (req, res) => {
  const slot = await Slot.findById(req.params.id);
  if (!slot) {
    res.status(404);
    throw new Error('Slot not found');
  }

  const { label, startTime, endTime, days, isActive } = req.body;
  if (label !== undefined && label !== slot.label) {
    const existing = await Slot.findOne({ label });
    if (existing) {
      res.status(400);
      throw new Error('A slot with this label already exists');
    }
    slot.label = label;
  }
  if (startTime !== undefined) slot.startTime = startTime;
  if (endTime !== undefined) slot.endTime = endTime;
  if (days !== undefined) slot.days = days;
  if (isActive !== undefined) slot.isActive = isActive;

  await slot.save();
  res.json({ success: true, data: slot });
});

const deleteSlot = asyncHandler(async (req, res) => {
  const slot = await Slot.findById(req.params.id);
  if (!slot) {
    res.status(404);
    throw new Error('Slot not found');
  }

  const batchCount = await Batch.countDocuments({ slot: slot._id });
  if (batchCount > 0) {
    res.status(400);
    throw new Error('Cannot delete a slot that is assigned to batches');
  }

  await slot.deleteOne();
  res.json({ success: true, message: 'Slot deleted' });
});

module.exports = { getSlots, getSlot, createSlot, updateSlot, deleteSlot };
