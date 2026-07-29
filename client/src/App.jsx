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
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="courses" element={<Courses />} />
                <Route path="batches" element={<Batches />} />
                <Route path="campuses" element={<Campuses />} />
                <Route path="cities" element={<Cities />} />
                <Route path="slots" element={<Slots />} />
                <Route path="trainers" element={<Trainers />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="payments" element={<Payments />} />
                <Route path="admin-users" element={<AdminUsers />} />
                <Route path="roles-permissions" element={<RolesPermissions />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
