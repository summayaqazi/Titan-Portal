import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import { ROLES } from './constants/roles';

import Login from './pages/auth/Login';
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

import SuperAdminLayout from './components/layout/SuperAdminLayout';
import Dashboard from './pages/superadmin/Dashboard';
import Students from './pages/superadmin/Students';
import Courses from './pages/superadmin/Courses';
import Batches from './pages/superadmin/Batches';
import Campuses from './pages/superadmin/Campuses';
import Cities from './pages/superadmin/Cities';
import Slots from './pages/superadmin/Slots';
import Trainers from './pages/superadmin/Trainers';
import Attendance from './pages/superadmin/Attendance';
import Payments from './pages/superadmin/Payments';
import AdminUsers from './pages/superadmin/AdminUsers';
import RolesPermissions from './pages/superadmin/RolesPermissions';
import Profile from './pages/superadmin/Profile';

import MarkAttendance from './pages/admin/MarkAttendance';
import ViewAttendance from './pages/admin/ViewAttendance';
import MultiAttendance from './pages/admin/MultiAttendance';
import TrainerMarkAttendance from './pages/admin/TrainerMarkAttendance';
import TrainerViewAttendance from './pages/admin/TrainerViewAttendance';
import TrainerAttendanceRequests from './pages/admin/TrainerAttendanceRequests';

import TrainerDashboard from './pages/trainer/Dashboard';
import TrainerCalendar from './pages/trainer/Calendar';
import TrainerAttendanceTab from './pages/trainer/Attendance';
import TrainerProfile from './pages/trainer/Profile';
import TrainerCourseWorkspace from './pages/trainer/CourseWorkspace';

import StudentDashboard from './pages/student/Dashboard';

// Each Super Admin / Admin page sits behind its own RoleRoute with a
// `module` key so permission edits made on the Roles & Permissions page are
// enforced route by route (SUPER_ADMIN's permissions are always all-true, so
// this doesn't change anything for that role).
function moduleRoute(module, path, element, roles = [ROLES.SUPER_ADMIN]) {
  return (
    <Route key={`${roles.join('-')}-${path}`} element={<RoleRoute allowedRoles={roles} module={module} />}>
      <Route path={path} element={element} />
    </Route>
  );
}

// Same page components, same permission-module gate, mounted under /admin
// instead of /super-admin for the ADMIN role. No page is duplicated — this
// just registers a second set of routes pointing at the same components.
function adminModuleRoute(module, path, element) {
  return moduleRoute(module, path, element, [ROLES.ADMIN]);
}

// Same pattern again for the Trainer portal.
function trainerModuleRoute(module, path, element) {
  return moduleRoute(module, path, element, [ROLES.TRAINER]);
}

// Same pattern again for the Student portal.
function studentModuleRoute(module, path, element) {
  return moduleRoute(module, path, element, [ROLES.STUDENT]);
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
              <Route path="/super-admin" element={<SuperAdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                {moduleRoute('dashboard', 'dashboard', <Dashboard />)}
                {moduleRoute('students', 'students', <Students />)}
                {moduleRoute('courses', 'courses', <Courses />)}
                {moduleRoute('batches', 'batches', <Batches />)}
                {moduleRoute('campuses', 'campuses', <Campuses />)}
                {moduleRoute('cities', 'cities', <Cities />)}
                {moduleRoute('slots', 'slots', <Slots />)}
                {moduleRoute('trainers', 'trainers', <Trainers />)}
                {moduleRoute('attendance', 'attendance', <Attendance />)}
                {moduleRoute('payments', 'payments', <Payments />)}
                {moduleRoute('adminUsers', 'admin-users', <AdminUsers />)}
                {moduleRoute('rolesPermissions', 'roles-permissions', <RolesPermissions />)}
                {moduleRoute('profile', 'profile', <Profile />)}
              </Route>
            </Route>

            <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
              <Route path="/admin" element={<SuperAdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                {adminModuleRoute('dashboard', 'dashboard', <Dashboard />)}
                {adminModuleRoute('students', 'students', <Students />)}
                {adminModuleRoute('attendance', 'attendance/mark', <MarkAttendance />)}
                {adminModuleRoute('attendance', 'attendance/view', <ViewAttendance />)}
                {adminModuleRoute('attendance', 'attendance/multi', <MultiAttendance />)}
                {adminModuleRoute('slots', 'slots', <Slots />)}
                {adminModuleRoute('trainers', 'trainers', <Trainers />)}
                {adminModuleRoute('attendance', 'trainer-attendance/mark', <TrainerMarkAttendance />)}
                {adminModuleRoute('attendance', 'trainer-attendance/view', <TrainerViewAttendance />)}
                {adminModuleRoute('attendance', 'trainer-attendance/requests', <TrainerAttendanceRequests />)}
                {/* Updation is intentionally not registered for ADMIN — sidebar entry,
                    route, and permission grant were all removed on purpose; the module
                    itself (page, API, backend route) is untouched for future/other use. */}
                {/* Not in the Admin sidebar — reachable via the "Generate Payment" link
                    from a student's Payments summary in the (shared) Student Detail Drawer. */}
                {adminModuleRoute('payments', 'payments', <Payments />)}
                {adminModuleRoute('profile', 'profile', <Profile />)}
              </Route>
            </Route>

            {/* Trainer Portal — reuses SuperAdminLayout exactly like Admin
                does (Sidebar/Header branch on user.role internally, no new
                layout component needed). Phase 2: Dashboard, Calendar and
                Profile are real; Attendance stays a Phase-3+ placeholder. */}
            <Route element={<RoleRoute allowedRoles={[ROLES.TRAINER]} />}>
              <Route path="/trainer" element={<SuperAdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                {trainerModuleRoute('dashboard', 'dashboard', <TrainerDashboard />)}
                {trainerModuleRoute('dashboard', 'calendar', <TrainerCalendar />)}
                {trainerModuleRoute('dashboard', 'courses/:batchId', <TrainerCourseWorkspace />)}
                {trainerModuleRoute('attendance', 'attendance', <TrainerAttendanceTab />)}
                {trainerModuleRoute('profile', 'profile', <TrainerProfile />)}
              </Route>
            </Route>

            {/* Student Portal — reuses SuperAdminLayout exactly like Admin
                and Trainer do (Sidebar/Header branch on user.role
                internally, no new layout component needed). Phase 1:
                Dashboard only, following the exact same incremental
                approach the Trainer Portal used. */}
            <Route element={<RoleRoute allowedRoles={[ROLES.STUDENT]} />}>
              <Route path="/student" element={<SuperAdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                {studentModuleRoute('dashboard', 'dashboard', <StudentDashboard />)}
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
