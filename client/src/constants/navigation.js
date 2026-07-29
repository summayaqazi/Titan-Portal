import {
  LayoutDashboard,
  Users,
  BookOpen,
  Layers,
  UserCog,
  CalendarCheck,
  Wallet,
  ShieldCheck,
  KeyRound,
  UserCircle,
} from 'lucide-react';

// Sidebar navigation for the Super Admin portal.
// `children` groups render as a collapsible section; items without
// `children` render as a direct link.
export const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Students', path: '/super-admin/students', icon: Users },
  {
    label: 'Academic Management',
    icon: BookOpen,
    children: [
      { label: 'Courses', path: '/super-admin/courses' },
      { label: 'Batches', path: '/super-admin/batches' },
    ],
  },
  {
    label: 'Administration',
    icon: Layers,
    children: [
      { label: 'Campuses', path: '/super-admin/campuses' },
      { label: 'Cities', path: '/super-admin/cities' },
      { label: 'Slots', path: '/super-admin/slots' },
    ],
  },
  { label: 'Trainers', path: '/super-admin/trainers', icon: UserCog },
  { label: 'Attendance', path: '/super-admin/attendance', icon: CalendarCheck },
  { label: 'Payments', path: '/super-admin/payments', icon: Wallet },
  { label: 'Admin Users', path: '/super-admin/admin-users', icon: ShieldCheck },
  { label: 'Roles & Permissions', path: '/super-admin/roles-permissions', icon: KeyRound },
  { label: 'Profile', path: '/super-admin/profile', icon: UserCircle },
];
