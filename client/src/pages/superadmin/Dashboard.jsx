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

// `iconClass` gives each stat's icon its own distinct, professional color
// instead of all-blue — the value/number text below stays the one uniform
// blue (#2877B9) for every card, set where StatCard is rendered below.
const STAT_CARD_DEFS = [
  { key: 'totalStudents', label: 'Total Students', icon: Users, iconClass: 'bg-emerald-50 text-emerald-600' },
  { key: 'enrolledStudents', label: 'Enrolled Students', icon: UserCheck, iconClass: 'bg-teal-50 text-teal-600' },
  { key: 'totalCourses', label: 'Courses', icon: BookOpen, iconClass: 'bg-violet-50 text-violet-600' },
  { key: 'totalCities', label: 'Cities', icon: MapPin, iconClass: 'bg-amber-50 text-amber-600' },
  { key: 'totalCampuses', label: 'Campuses', icon: Building2, iconClass: 'bg-rose-50 text-rose-600' },
  { key: 'totalTrainers', label: 'Trainers', icon: UserCog, iconClass: 'bg-indigo-50 text-indigo-600' },
  { key: 'activeSlots', label: 'Active Slots', icon: Clock, iconClass: 'bg-cyan-50 text-cyan-600' },
  { key: 'registrationOpenBatches', label: 'Registration Open', icon: ClipboardCheck, iconClass: 'bg-orange-50 text-orange-600' },
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
        // Shared by Super Admin (all 8 cards) and Admin (6, via
        // statCardDefs' filter above) — this is the one Dashboard.jsx both
        // portals render, so the mobile-2-per-row fix below applies to
        // both automatically without touching Trainer/Student, which each
        // have their own separate dashboard page and never hit this file.
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {statCardDefs.map(({ key, label, icon, iconClass }) => (
            <StatCard
              key={key}
              label={label}
              icon={icon}
              value={statsLoading ? '—' : (stats?.[key] ?? 0)}
              valueClassName="text-[#2877B9]"
              iconClassName={iconClass}
              // Smaller padding/icon/gap only below `sm` — two cards per
              // row at phone widths need tighter internal spacing than the
              // original single-column card did to avoid feeling cramped;
              // `sm:` and up restores the exact original card look.
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:gap-4 sm:p-5"
              iconWrapClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
              // StatCard's label is `truncate` (ellipsis) by default. Below
              // `sm`, two-per-row cards are narrow enough that a longer
              // label (e.g. "Registration Open") would truncate to
              // something unreadable, so it wraps onto two lines there
              // instead — `max-sm:whitespace-normal!` beats the hardcoded
              // `truncate` via Tailwind's important modifier, but only
              // below `sm`, so `sm:` and up keeps the original single-line
              // truncated label untouched.
              labelClassName="text-slate-500 max-sm:whitespace-normal! max-sm:break-words max-sm:leading-snug"
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
