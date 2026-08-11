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

const PERMISSION_MODULES = [
  'dashboard',
  'students',
  'courses',
  'batches',
  'cities',
  'campuses',
  'slots',
  'trainers',
  'attendance',
  'payments',
  'adminUsers',
  'rolesPermissions',
  'updation',
  'profile',
  'assignments',
  'quizzes',
  'progress',
  'feedback',
];

const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

module.exports = { ROLES, ENROLLMENT_STATUSES, PAYMENT_STATUSES, PERMISSION_MODULES, PERMISSION_ACTIONS };
