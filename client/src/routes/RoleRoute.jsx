import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// `module` is optional and additive: when provided, the route also requires
// `can(module, 'view')` on top of the role check. SUPER_ADMIN's permissions
// are always all-true (see AuthContext/server checkPermission), so this is a
// no-op for the only role that can log in today, and real enforcement once
// other roles gain portal access.
export default function RoleRoute({ allowedRoles, module }) {
  const { user, loading, can } = useAuth();

  // Auth state (user/permissions) may still be hydrating from localStorage
  // or resolving right after login — never evaluate role/permission checks
  // until that settles, or a not-yet-populated `user` reads as "no access".
  if (loading) return null;

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (module && !can(module, 'view')) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
