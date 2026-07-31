const express = require('express');
const {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} = require('../controllers/adminUser.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getAdminUsers).post(createAdminUser);
router.route('/:id').put(updateAdminUser).delete(deleteAdminUser);

module.exports = router;
