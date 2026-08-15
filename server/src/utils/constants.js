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

// Public course-registration review lifecycle (Registration.status). A
// Registration is a standalone pre-Student record — see models/
// Registration.js's own header comment for why this exists as its own
// collection rather than reusing Enrollment.status the way the app used to.
// Deliberately just these three: unlike ENROLLMENT_STATUSES' long academic
// lifecycle (passed/completed/dropout/...), a Registration's only job is
// "should this person become a Student," nothing past that.
const REGISTRATION_STATUSES = ['pending', 'approved', 'rejected'];

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
  // Public course-registration review queue — see Registration.js/
  // registration.controller.js. Deliberately its own module, separate from
  // 'students': a Registration is reviewed/approved/rejected BEFORE any
  // Student exists, so gating it on 'students' would be gating it on a
  // permission about a different collection. Same "give the new module its
  // own key" convention 'applications' already established above (never
  // reuse 'jobs' for application review either).
  'registrations',
];

const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

module.exports = {
  ROLES,
  ENROLLMENT_STATUSES,
  PAYMENT_STATUSES,
  JOB_TYPES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  REGISTRATION_STATUSES,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
};
