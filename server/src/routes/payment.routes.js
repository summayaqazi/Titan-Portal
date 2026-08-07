const express = require('express');
const {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  generatePlan,
  getInvoice,
  getReceipt,
  regeneratePayment,
} = require('../controllers/payment.controller');
const { protect, authorize, checkPermission } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.post('/generate-plan', checkPermission('payments', 'create'), generatePlan);

router
  .route('/')
  .get(checkPermission('payments', 'view'), getPayments)
  .post(checkPermission('payments', 'create'), createPayment);
router
  .route('/:id')
  .put(checkPermission('payments', 'update'), updatePayment)
  .delete(checkPermission('payments', 'delete'), deletePayment);

router.get('/:id/invoice', checkPermission('payments', 'export'), getInvoice);
router.get('/:id/receipt', checkPermission('payments', 'export'), getReceipt);
router.post('/:id/regenerate', checkPermission('payments', 'create'), regeneratePayment);

module.exports = router;
