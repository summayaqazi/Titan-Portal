import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';

// Single source of truth for the localStorage key the Dashboard's Campus
// Selector writes to and every other Admin page reads from.
export const SELECTED_CAMPUS_KEY = 'admin_dashboard_campus';

// Every Admin Portal list/detail page reads the campus selected on the
// Dashboard through this hook and passes it into its existing API calls as
// a `campus` filter — the selector itself only lives on the Dashboard;
// switching pages re-reads the latest selection on mount (no separate
// selector control elsewhere, no UI change). Always undefined for any role
// other than ADMIN, so Super Admin's queries are byte-for-byte unaffected.
export default function useAdminCampusFilter() {
  const { user } = useAuth();
  const [campusId] = useState(() =>
    user?.role === ROLES.ADMIN ? localStorage.getItem(SELECTED_CAMPUS_KEY) || undefined : undefined
  );
  return campusId;
}
