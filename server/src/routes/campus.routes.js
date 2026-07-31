const express = require('express');
const {
  getCampuses,
  getCampus,
  createCampus,
  updateCampus,
  deleteCampus,
} = require('../controllers/campus.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getCampuses).post(createCampus);
router.route('/:id').get(getCampus).put(updateCampus).delete(deleteCampus);

module.exports = router;
