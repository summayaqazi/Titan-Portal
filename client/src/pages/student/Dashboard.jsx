import { useEffect, useState } from 'react';
import { BookOpen, CalendarCheck, Wallet, Clock, MapPin, User as UserIcon, Calendar as CalendarIcon } from 'lucide-react';
import { PageContainer, EmptyState } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Compact current-week strip (Sun–Sat), same shape/behavior as the Trainer
// Portal's "Teaching Schedule" widget (see pages/trainer/Dashboard.jsx) —
// today is always the light highlight, a day with a class is the dark
// highlight, and today-that's-also-a-class-day gets the light highlight
// plus a stronger border so neither signal is lost.
function ScheduleWidget({ schedule, loading }) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const datesWithClasses = new Set(schedule.map((item) => item.date));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <CalendarIcon size={16} className="text-blue-600" /> Class Schedule
      </h2>
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="flex gap-1.5">
          {days.map((d) => {
            const key = localDateKey(d);
            const isToday = key === localDateKey(today);
            const hasClass = datesWithClasses.has(key);
            const isTodayClass = isToday && hasClass;
            const todayBorder = isTodayClass ? 'border-2 border-blue-600' : 'border border-blue-200';
            const style = isToday
              ? `${todayBorder} bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100`
              : hasClass
              ? 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100';
            return (
              <div
                key={key}
                title={hasClass ? 'Has a scheduled class' : 'No class scheduled'}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-medium transition-colors ${style}`}
              >
                <span className={isToday ? 'text-blue-700' : hasClass ? 'text-white/80' : ''}>{DAY_ABBR[d.getDay()]}</span>
                <span
                  className={`text-sm font-semibold ${
                    isToday ? 'text-blue-700' : hasClass ? 'text-white' : 'text-slate-800'
                  }`}
                >
                  {d.getDate()}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${
                    !hasClass ? 'bg-transparent' : isToday ? 'bg-blue-600' : 'bg-white'
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-base font-semibold text-slate-800">{course.courseName}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
        <MapPin size={12} /> {course.campus} · {course.batchCode}
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Clock size={13} />
        {course.slot ? `${course.slot.label} · ${course.slot.startTime}–${course.slot.endTime}` : 'No slot assigned'}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Progress</span>
          <span>{course.progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${course.progress}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <UserIcon size={13} /> {course.trainerName || 'Unassigned'}
        </span>
        <span>Enrolled {formatDate(course.admissionDate)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    studentPortalApi
      .getDashboard()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load dashboard'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data?.stats || { enrolledCourses: 0, attendancePercent: 0, pendingPayments: 0 };
  const schedule = data?.schedule || [];
  const courses = data?.courses || [];

  return (
    <PageContainer title="Dashboard" description="Your learning overview">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
              <StatCard label="Enrolled Courses" icon={BookOpen} value={loading ? '—' : stats.enrolledCourses} />
              <StatCard label="Attendance" icon={CalendarCheck} value={loading ? '—' : `${stats.attendancePercent}%`} />
              <StatCard label="Pending Payments" icon={Wallet} value={loading ? '—' : stats.pendingPayments} />
            </div>
            <ScheduleWidget schedule={schedule} loading={loading} />
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-base font-semibold text-slate-800">My Courses</h2>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : courses.length === 0 ? (
              <EmptyState title="No enrolled courses" description="You are not enrolled in any active course yet." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.enrollmentId} course={course} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
