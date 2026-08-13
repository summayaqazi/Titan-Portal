const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  TRAINER: 'TRAINER',
  STUDENT: 'STUDENT',
  // Job Portal — a job applicant's account. Distinct from STUDENT (a job
  // applicant is not automatically a student). Additive only: every
  // existing `ROLES.*` check/allowlist elsewhere in the app already only
  // matches roles it explicitly lists, so this new value grants no access
  // anywhere until a route/permission explicitly opts it in.
  APPLICANT: 'APPLICANT',
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

// Job Portal — Job.jobType. 'Employment Type' is intentionally not a
// separate field: the spec warned against duplicating job type and
// employment type without a genuine reason, so this one enum covers both.
const JOB_TYPES = ['full_time', 'part_time', 'contract'];

// Job Portal — Job.status lifecycle (draft -> open -> closed). "Publish"
// and "Open" are the same state (one `open` value), not two fields.
const JOB_STATUSES = ['draft', 'open', 'closed'];

// Job Portal — Application.status. Shortlist/Approve/Reject are status
// values written through the same single status-update action, not
// separate permission actions — same convention ENROLLMENT_STATUSES/
// updateEnrollment already use.
const APPLICATION_STATUSES = ['pending', 'under_review', 'shortlisted', 'approved', 'rejected'];

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
  // Job Portal (backend foundation only in this phase — no routes/UI wired
  // to these yet). 'jobs' gates Job CRUD/publish/close; 'applications'
  // gates application review/status-change/CV download.
  'jobs',
  'applications',
];

const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

module.exports = {
  ROLES,
  ENROLLMENT_STATUSES,
  PAYMENT_STATUSES,
  JOB_TYPES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
};
