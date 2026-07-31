const express = require('express');
const { getBatches, getBatch, createBatch, updateBatch, deleteBatch } = require('../controllers/batch.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getBatches).post(createBatch);
router.route('/:id').get(getBatch).put(updateBatch).delete(deleteBatch);

module.exports = router;
