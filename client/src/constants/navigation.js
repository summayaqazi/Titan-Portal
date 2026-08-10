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
} from 'lucide-react';

// Sidebar navigation for the Super Admin portal.
// `children` groups render as a collapsible section; items without
// `children` render as a direct link.
// `module` keys map to the permission modules configured on the Roles &
// Permissions page — Sidebar filters items/children via can(module, 'view').
export const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Students', path: '/super-admin/students', icon: Users, module: 'students' },
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
  {
    label: 'Attendance',
    icon: CalendarCheck,
    children: [
      { label: 'Mark Attendance', path: '/admin/attendance/mark', module: 'attendance' },
      { label: 'View Attendance', path: '/admin/attendance/view', module: 'attendance' },
      { label: 'Multi Attendance', path: '/admin/attendance/multi', module: 'attendance' },
    ],
  },
  {
    label: 'Administration',
    icon: Layers,
    children: [{ label: 'Slots', path: '/admin/slots', module: 'slots' }],
  },
  { label: 'Trainers', path: '/admin/trainers', icon: UserCog, module: 'trainers' },
  {
    label: 'Trainer Attendance',
    icon: ClipboardList,
    children: [
      { label: 'Mark Attendance', path: '/admin/trainer-attendance/mark', module: 'attendance' },
      { label: 'View Attendance', path: '/admin/trainer-attendance/view', module: 'attendance' },
      { label: 'Attendance Request', path: '/admin/trainer-attendance/requests', module: 'attendance' },
    ],
  },
  { label: 'Profile', path: '/admin/profile', icon: UserCircle, module: 'profile' },
];

// Sidebar navigation for the Trainer portal. Calendar has no dedicated
// permission module (it's a read-only view of the trainer's own schedule,
// same sensitivity as Dashboard) so it's gated on the `dashboard` module
// like Dashboard itself, rather than adding a new permission module for it.
// No Profile entry here — the sidebar's bottom profile card is the entry
// point into /trainer/profile instead (see Sidebar.jsx).
export const TRAINER_NAV = [
  { label: 'Dashboard', path: '/trainer/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Calendar', path: '/trainer/calendar', icon: Calendar, module: 'dashboard' },
  { label: 'Attendance', path: '/trainer/attendance', icon: CalendarCheck, module: 'attendance' },
];

// Student Portal — Phase 1 (Dashboard) is done; Assignments (view + submit,
// server-enforced deadlines) is Phase 2. More entries (Courses, Attendance,
// Payments, ...) land in later phases as their pages ship, following the
// exact same incremental approach TRAINER_NAV above did.
export const STUDENT_NAV = [
  { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Assignments', path: '/student/assignments', icon: ClipboardList, module: 'assignments' },
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
