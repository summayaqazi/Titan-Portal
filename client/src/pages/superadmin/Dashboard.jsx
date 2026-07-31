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
} from 'lucide-react';
import { PageContainer } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart';
import useEnrollmentAnalytics from '../../hooks/useEnrollmentAnalytics';
import { getDashboardStats, getCampusAnalytics, getCourseAnalytics } from '../../api/dashboardApi';

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
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const campusAnalytics = useEnrollmentAnalytics(getCampusAnalytics);
  const courseAnalytics = useEnrollmentAnalytics(getCourseAnalytics);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setStatsError('');

    getDashboardStats()
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
  }, []);

  return (
    <PageContainer title="Dashboard" description="Overview of your institute's activity">
      {statsError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={18} />
          {statsError}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARD_DEFS.map(({ key, label, icon }) => (
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
