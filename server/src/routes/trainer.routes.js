const express = require('express');
const {
  getTrainers,
  getTrainer,
  createTrainer,
  updateTrainer,
  deleteTrainer,
} = require('../controllers/trainer.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getTrainers).post(createTrainer);
router.route('/:id').get(getTrainer).put(updateTrainer).delete(deleteTrainer);

module.exports = router;
