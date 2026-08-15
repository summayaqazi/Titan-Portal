// Mirrors server/src/utils/constants.js — keep in sync.
export const PERMISSION_MODULES = [
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
  // Public course-registration review queue — deliberately separate from
  // 'students': a Registration is reviewed before any Student exists. See
  // server/src/models/Registration.js's header comment.
  'registrations',
];

export const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

export const MODULE_LABELS = {
  dashboard: 'Dashboard',
  students: 'Students',
  courses: 'Courses',
  batches: 'Batches',
  cities: 'Cities',
  campuses: 'Campuses',
  slots: 'Slots',
  trainers: 'Trainers',
  attendance: 'Attendance',
  payments: 'Payments',
  adminUsers: 'Admin Users',
  rolesPermissions: 'Roles & Permissions',
  updation: 'Updation',
  profile: 'Profile',
  assignments: 'Assignments',
  quizzes: 'Quizzes',
  progress: 'Course Progress',
  feedback: 'Feedback',
  registrations: 'Student Registrations',
};
