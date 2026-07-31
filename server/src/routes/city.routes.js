const express = require('express');
const { getCities, getCity, createCity, updateCity, deleteCity } = require('../controllers/city.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getCities).post(createCity);
router.route('/:id').get(getCity).put(updateCity).delete(deleteCity);

module.exports = router;
