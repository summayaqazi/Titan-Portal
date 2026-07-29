const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  TRAINER: 'TRAINER',
  STUDENT: 'STUDENT',
};

const ENROLLMENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'passed',
  'failed',
  'enrolled',
  'completed',
  'eliminated',
  'dropout',
  'cancelled',
  'certified',
  'blacklisted',
];

const PAYMENT_STATUSES = ['pending', 'partial', 'paid', 'overdue', 'refunded', 'waived'];

module.exports = { ROLES, ENROLLMENT_STATUSES, PAYMENT_STATUSES };
