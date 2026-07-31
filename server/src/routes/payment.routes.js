const express = require('express');
const { getPayments, createPayment, updatePayment, deletePayment } = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.route('/').get(getPayments).post(createPayment);
router.route('/:id').put(updatePayment).delete(deletePayment);

module.exports = router;
