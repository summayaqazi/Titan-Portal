const express = require('express');
const { getBatches, getBatch, createBatch, updateBatch, deleteBatch } = require('../controllers/batch.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router
  .route('/')
  .get(checkPermission('batches', 'view'), getBatches)
  .post(checkPermission('batches', 'create'), createBatch);
router
  .route('/:id')
  .get(checkPermission('batches', 'view'), getBatch)
  .put(checkPermission('batches', 'update'), updateBatch)
  .delete(checkPermission('batches', 'delete'), deleteBatch);

module.exports = router;
