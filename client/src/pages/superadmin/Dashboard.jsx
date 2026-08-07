import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  BookOpen,
  MapPin,
  Building2,
  UserCog,
  Clock,
  ClipboardCheck,
  AlertCircle,
  Building,
} from 'lucide-react';
import { PageContainer, Select } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart';
import useEnrollmentAnalytics from '../../hooks/useEnrollmentAnalytics';
import { getDashboardStats, getCampusAnalytics, getCourseAnalytics } from '../../api/dashboardApi';
import campusesApi from '../../api/campusesApi';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { SELECTED_CAMPUS_KEY } from '../../hooks/useAdminCampusFilter';

// Persists the Admin Portal's selected campus across navigation within the
// session — cleared on logout (see AuthContext) and re-validated against
// the campuses the logged-in admin actually has on every load, so a stale
// value from a previous account can never leak through. Every other Admin
// Portal page reads this same key via useAdminCampusFilter() to filter its
// own data — see that hook for the single source of truth on the key name.

const STAT_CARD_DEFS = [
  { key: 'totalStudents', label: 'Total Students', icon: Users },
  { key: 'enrolledStudents', label: 'Enrolled Students', icon: UserCheck },
  { key: 'totalCourses', label: 'Courses', icon: BookOpen },
  { key: 'totalCities', label: 'Cities', icon: MapPin },
  { key: 'totalCampuses', label: 'Campuses', icon: Building2 },
  { key: 'totalTrainers', label: 'Trainers', icon: UserCog },
  { key: 'activeSlots', label: 'Active Slots', icon: Clock },
  { key: 'registrationOpenBatches', label: 'Registration Open', icon: ClipboardCheck },
];

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  // Every campus the admin has permission to access — reuses the existing
  // campuses API/list (the same one Trainers/Students already call), which
  // is itself gated by the admin's `campuses` module permission. Never
  // limited to a single assigned campus.
  const [accessibleCampuses, setAccessibleCampuses] = useState([]);
  const [campusesLoading, setCampusesLoading] = useState(isAdmin);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setCampusesLoading(true);
    campusesApi
      .list({ limit: 100 })
      .then((res) => {
        if (!cancelled) setAccessibleCampuses(res.data);
      })
      .finally(() => {
        if (!cancelled) setCampusesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const [selectedCampusId, setSelectedCampusId] = useState(() => {
    if (!isAdmin) return undefined;
    return localStorage.getItem(SELECTED_CAMPUS_KEY) || undefined;
  });

  // Once the accessible-campus list loads, make sure the selection is
  // actually one of them — covers a stale value from a previous account/DB
  // state and picks a default (first campus) the first time there's none.
  useEffect(() => {
    if (!isAdmin || campusesLoading) return;
    const valid = accessibleCampuses.some((c) => c._id === selectedCampusId);
    if (!valid) {
      const fallback = accessibleCampuses[0]?._id;
      setSelectedCampusId(fallback);
      if (fallback) localStorage.setItem(SELECTED_CAMPUS_KEY, fallback);
      else localStorage.removeItem(SELECTED_CAMPUS_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, campusesLoading, accessibleCampuses]);

  // The Admin can switch campuses at any time — selecting one immediately
  // re-triggers every dashboard fetch below via the campusParam dependency.
  const handleCampusChange = (campusId) => {
    setSelectedCampusId(campusId);
    localStorage.setItem(SELECTED_CAMPUS_KEY, campusId);
  };

  // Cities/Campuses are always 1 in a single-campus view, so they're not
  // meaningful stats on the Admin Dashboard — Super Admin's global view is
  // unaffected and keeps all 8 cards.
  const statCardDefs = isAdmin
    ? STAT_CARD_DEFS.filter((c) => c.key !== 'totalCities' && c.key !== 'totalCampuses')
    : STAT_CARD_DEFS;

  const campusParam = isAdmin ? selectedCampusId : undefined;
  // While an admin's campus selection hasn't resolved yet, hold off — avoids
  // a flash of unscoped/global stats before the campus filter kicks in.
  const readyToLoad = !isAdmin || Boolean(campusParam);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const campusAnalytics = useEnrollmentAnalytics(getCampusAnalytics, { campus: campusParam }, { ready: readyToLoad });
  const courseAnalytics = useEnrollmentAnalytics(getCourseAnalytics, { campus: campusParam }, { ready: readyToLoad });

  useEffect(() => {
    if (!readyToLoad) return;
    let cancelled = false;
    setStatsLoading(true);
    setStatsError('');

    getDashboardStats({ campus: campusParam })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStatsError('Failed to load dashboard statistics');
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [readyToLoad, campusParam]);

  return (
    <PageContainer title="Dashboard" description="Overview of your institute's activity">
      {isAdmin && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Building size={16} className="text-slate-400" />
          <span className="text-slate-500">Campus</span>
          <Select
            className="w-auto"
            value={selectedCampusId || ''}
            onChange={(e) => handleCampusChange(e.target.value)}
            disabled={campusesLoading || accessibleCampuses.length === 0}
          >
            {campusesLoading ? (
              <option value="">Loading campuses…</option>
            ) : accessibleCampuses.length === 0 ? (
              <option value="">No campuses available</option>
            ) : (
              accessibleCampuses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))
            )}
          </Select>
        </div>
      )}

      {statsError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={18} />
          {statsError}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCardDefs.map(({ key, label, icon }) => (
            <StatCard
              key={key}
              label={label}
              icon={icon}
              value={statsLoading ? '—' : (stats?.[key] ?? 0)}
            />
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6">
        <AnalyticsChart
          title="Campus Analytics"
          subtitle="Student enrollment by campus location"
          data={campusAnalytics.data}
          loading={campusAnalytics.loading}
          error={campusAnalytics.error}
          sort={campusAnalytics.sort}
          onSortChange={campusAnalytics.changeSort}
          page={campusAnalytics.page}
          totalPages={campusAnalytics.totalPages}
          onPageChange={campusAnalytics.setPage}
        />

        <AnalyticsChart
          title="Course Analytics"
          subtitle="Student enrollment distribution by course"
          data={courseAnalytics.data}
          loading={courseAnalytics.loading}
          error={courseAnalytics.error}
          sort={courseAnalytics.sort}
          onSortChange={courseAnalytics.changeSort}
          page={courseAnalytics.page}
          totalPages={courseAnalytics.totalPages}
          onPageChange={courseAnalytics.setPage}
        />
      </div>
    </PageContainer>
  );
}
