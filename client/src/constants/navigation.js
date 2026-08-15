import {
  LayoutDashboard,
  Users,
  BookOpen,
  Layers,
  UserCog,
  CalendarCheck,
  Calendar,
  Wallet,
  ShieldCheck,
  KeyRound,
  UserCircle,
  ClipboardList,
  TrendingUp,
  FileQuestion,
  Briefcase,
} from 'lucide-react';

// Sidebar navigation for the Super Admin portal.
// `children` groups render as a collapsible section; items without
// `children` render as a direct link.
// `module` keys map to the permission modules configured on the Roles &
// Permissions page — Sidebar filters items/children via can(module, 'view').
export const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Students', path: '/super-admin/students', icon: Users, module: 'students' },
  // No "Student Registrations" sidebar entry, deliberately — Registrations
  // is a real module (own route/page/API, gated by its own 'registrations'
  // permission — see registration.controller.js/Registration.js) but its
  // entry point is the Dashboard's own "Student Registrations/Pending/
  // Approved/Rejected" card family (Dashboard.jsx's JOB_PORTAL_CARD_DEFS),
  // never the sidebar. The route (`/super-admin/registrations`, still
  // registered in App.jsx) and RoleRoute's permission gate on it are both
  // untouched — only this menu entry is gone, so the page is reached
  // exactly one way: Dashboard card -> Registration API -> data.
  {
    label: 'Academic Management',
    icon: BookOpen,
    children: [
      { label: 'Courses', path: '/super-admin/courses', module: 'courses' },
      { label: 'Batches', path: '/super-admin/batches', module: 'batches' },
    ],
  },
  {
    label: 'Administration',
    icon: Layers,
    children: [
      { label: 'Campuses', path: '/super-admin/campuses', module: 'campuses' },
      { label: 'Cities', path: '/super-admin/cities', module: 'cities' },
      { label: 'Slots', path: '/super-admin/slots', module: 'slots' },
    ],
  },
  { label: 'Trainers', path: '/super-admin/trainers', icon: UserCog, module: 'trainers' },
  { label: 'Attendance', path: '/super-admin/attendance', icon: CalendarCheck, module: 'attendance' },
  { label: 'Payments', path: '/super-admin/payments', icon: Wallet, module: 'payments' },
  {
    label: 'Job Portal',
    icon: Briefcase,
    children: [
      { label: 'Jobs', path: '/super-admin/jobs', module: 'jobs' },
      { label: 'Applications', path: '/super-admin/applications', module: 'applications' },
    ],
  },
  { label: 'Admin Users', path: '/super-admin/admin-users', icon: ShieldCheck, module: 'adminUsers' },
  { label: 'Roles & Permissions', path: '/super-admin/roles-permissions', icon: KeyRound, module: 'rolesPermissions' },
  { label: 'Profile', path: '/super-admin/profile', icon: UserCircle, module: 'profile' },
];

// Sidebar navigation for the Admin (campus-level) portal. Same reused pages
// as Super Admin, wired to /admin/* routes with a narrower menu — visibility
// of each item is still gated by the role's actual permissions via Sidebar's
// can(module, 'view') filter, this list just controls ordering/grouping.
export const ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Students', path: '/admin/students', icon: Users, module: 'students' },
  // Same 'registrations' module as Super Admin — invisible here (Sidebar's
  // own can(module,'view') filter) until an Admin's role is explicitly
  // granted it on the Roles & Permissions page; unset (false) by default.
  { label: 'Student Registrations', path: '/admin/registrations', icon: ClipboardList, module: 'registrations' },
  // Single "Attendance" group covering both Student and Trainer attendance
  // — the Trainer sub-items (Mark/View/Request) used to live under their
  // own separate top-level "Trainer Attendance" group; that group is gone
  // (sidebar ordering requirement: only one "Attendance" entry) and its 3
  // links now live here instead, relabeled ("... Trainer Attendance") so
  // they don't collide with the Student ones' identical names in the same
  // dropdown. Same routes/pages/permissions as before — moved, not removed.
  {
    label: 'Attendance',
    icon: CalendarCheck,
    children: [
      { label: 'Mark Attendance', path: '/admin/attendance/mark', module: 'attendance' },
      { label: 'View Attendance', path: '/admin/attendance/view', module: 'attendance' },
      { label: 'Multi Attendance', path: '/admin/attendance/multi', module: 'attendance' },
      { label: 'Mark Trainer Attendance', path: '/admin/trainer-attendance/mark', module: 'attendance' },
      { label: 'View Trainer Attendance', path: '/admin/trainer-attendance/view', module: 'attendance' },
      { label: 'Trainer Attendance Requests', path: '/admin/trainer-attendance/requests', module: 'attendance' },
    ],
  },
  {
    label: 'Administration',
    icon: Layers,
    children: [{ label: 'Slots', path: '/admin/slots', module: 'slots' }],
  },
  { label: 'Trainers', path: '/admin/trainers', icon: UserCog, module: 'trainers' },
  // Job Portal Phase 5 — Campus Admin manages jobs (creation/edit/publish/
  // close/delete restricted server-side to the ones they created — see
  // job.controller.js). No Applications entry: application review stays
  // Super-Admin-only this phase (Admin's 'applications' permission grant
  // is empty, so that page would just 403 for them).
  { label: 'Jobs', path: '/admin/jobs', icon: Briefcase, module: 'jobs' },
  { label: 'Profile', path: '/admin/profile', icon: UserCircle, module: 'profile' },
];

// Sidebar navigation for the Trainer portal. Calendar has no dedicated
// permission module (it's a read-only view of the trainer's own schedule,
// same sensitivity as Dashboard) so it's gated on the `dashboard` module
// like Dashboard itself, rather than adding a new permission module for it.
// No Profile entry here — the sidebar's bottom profile card is the entry
// point into /trainer/profile instead (see Sidebar.jsx).
// Attendance is a group (mirroring ADMIN_NAV's own Attendance group shape)
// as of the Face + Location Attendance feature — "Mark Attendance" is the
// new self-service Face+Location+Schedule verified check-in; "My
// Attendance" is the pre-existing read-only history page, same
// path/component as before, untouched.
export const TRAINER_NAV = [
  { label: 'Dashboard', path: '/trainer/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Calendar', path: '/trainer/calendar', icon: Calendar, module: 'dashboard' },
  {
    label: 'Attendance',
    icon: CalendarCheck,
    children: [
      { label: 'Mark Attendance', path: '/trainer/attendance/mark', module: 'attendance' },
      { label: 'My Attendance', path: '/trainer/attendance', module: 'attendance' },
    ],
  },
];

// Student Portal — Phase 1 (Dashboard) is done; Assignments (view + submit,
// server-enforced deadlines) is Phase 2; Progress and Attendance (both
// read-only) are Phase 3; Payments (read-only) is Phase 4; Quiz + take-quiz
// (server-graded attempts) is Phase 5; Course Details (Phase 6) is a
// Dashboard drill-down, not its own nav entry; Profile + Edit Profile is
// Phase 7 — a trailing nav item here, same placement as SUPER_ADMIN_NAV/
// ADMIN_NAV's own Profile entries (Student has no Trainer-style bottom
// sidebar profile card — the Header's own dropdown already covers
// avatar/name/Logout for this role, same as Super Admin/Admin).
export const STUDENT_NAV = [
  { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Progress', path: '/student/progress', icon: TrendingUp, module: 'progress' },
  { label: 'Attendance', path: '/student/attendance', icon: CalendarCheck, module: 'attendance' },
  { label: 'Payments', path: '/student/payments', icon: Wallet, module: 'payments' },
  { label: 'Assignments', path: '/student/assignments', icon: ClipboardList, module: 'assignments' },
  { label: 'Quiz', path: '/student/quizzes', icon: FileQuestion, module: 'quizzes' },
  { label: 'Profile', path: '/student/profile', icon: UserCircle, module: 'profile' },
];

// Applicant Portal (Job Portal Phase 4) — read-only application tracking.
// Dashboard and My Applications both gate on the 'applications' module
// (they're both just applications views — see seed.js's own comment on the
// APPLICANT role for why this doesn't get a dedicated 'dashboard' grant).
export const APPLICANT_NAV = [
  { label: 'Dashboard', path: '/applicant/dashboard', icon: LayoutDashboard, module: 'applications' },
  { label: 'My Applications', path: '/applicant/applications', icon: Briefcase, module: 'applications' },
  { label: 'Profile', path: '/applicant/profile', icon: UserCircle, module: 'profile' },
];

// Flattens a nav list (including grouped children) down to the set of
// permission-module keys it actually links to. Used to curate the
// Permissions badges on the Profile page to "modules with a real menu
// entry" rather than every module the role happens to have view access to
// (some are granted only to back reference-data dropdowns, e.g. Cities for
// Admin) — reuses this same nav config instead of a second hardcoded list.
export function getNavModules(nav) {
  const modules = new Set();
  nav.forEach((item) => {
    if (item.children) {
      item.children.forEach((child) => child.module && modules.add(child.module));
    } else if (item.module) {
      modules.add(item.module);
    }
  });
  return modules;
}
