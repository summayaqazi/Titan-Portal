const express = require('express');
const { getSlots, getSlot, createSlot, updateSlot, deleteSlot } = require('../controllers/slot.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router
  .route('/')
  .get(checkPermission('slots', 'view'), getSlots)
  .post(checkPermission('slots', 'create'), createSlot);
router
  .route('/:id')
  .get(checkPermission('slots', 'view'), getSlot)
  .put(checkPermission('slots', 'update'), updateSlot)
  .delete(checkPermission('slots', 'delete'), deleteSlot);

module.exports = router;
