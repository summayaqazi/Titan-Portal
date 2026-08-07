const express = require('express');
const {
  getTrainers,
  getTrainer,
  createTrainer,
  updateTrainer,
  deleteTrainer,
} = require('../controllers/trainer.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');
const upload = require('../middleware/upload.middleware');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router
  .route('/')
  .get(checkPermission('trainers', 'view'), getTrainers)
  .post(checkPermission('trainers', 'create'), upload.single('profileImage'), createTrainer);
router
  .route('/:id')
  .get(checkPermission('trainers', 'view'), getTrainer)
  .put(checkPermission('trainers', 'update'), upload.single('profileImage'), updateTrainer)
  .delete(checkPermission('trainers', 'delete'), deleteTrainer);

module.exports = router;
