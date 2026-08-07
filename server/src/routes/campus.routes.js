const express = require('express');
const {
  getCampuses,
  getCampus,
  createCampus,
  updateCampus,
  deleteCampus,
} = require('../controllers/campus.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router
  .route('/')
  .get(checkPermission('campuses', 'view'), getCampuses)
  .post(checkPermission('campuses', 'create'), createCampus);
router
  .route('/:id')
  .get(checkPermission('campuses', 'view'), getCampus)
  .put(checkPermission('campuses', 'update'), updateCampus)
  .delete(checkPermission('campuses', 'delete'), deleteCampus);

module.exports = router;
