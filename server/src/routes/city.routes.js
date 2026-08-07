const express = require('express');
const { getCities, getCity, createCity, updateCity, deleteCity } = require('../controllers/city.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router
  .route('/')
  .get(checkPermission('cities', 'view'), getCities)
  .post(checkPermission('cities', 'create'), createCity);
router
  .route('/:id')
  .get(checkPermission('cities', 'view'), getCity)
  .put(checkPermission('cities', 'update'), updateCity)
  .delete(checkPermission('cities', 'delete'), deleteCity);

module.exports = router;
