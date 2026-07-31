const express = require('express');
const { getSlots, getSlot, createSlot, updateSlot, deleteSlot } = require('../controllers/slot.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getSlots).post(createSlot);
router.route('/:id').get(getSlot).put(updateSlot).delete(deleteSlot);

module.exports = router;
