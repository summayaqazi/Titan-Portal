import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, ClipboardList, Clock, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import { PageContainer, EmptyState } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import trainerPortalApi from '../../api/trainerPortalApi';
import { getErrorMessage } from '../../utils/errors';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Compact current-week strip (Sun–Sat, today highlighted) instead of a long
// list — a day with at least one class gets a small dot so it stays useful
// without needing the full per-class detail (that's what Calendar is for).
function ScheduleWidget({ schedule, loading, onSelectDay }) {
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
        <CalendarIcon size={16} className="text-blue-600" /> Teaching Schedule
      </h2>
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="flex gap-1.5">
          {days.map((d) => {
            const key = localDateKey(d);
            const isToday = key === localDateKey(today);
            const hasClass = datesWithClasses.has(key);
            const isTodayTeaching = isToday && hasClass;
            // Today always gets the LIGHT highlight (tinted background), even
            // when it's also a teaching day — a non-today teaching day gets
            // the DARK highlight (solid fill) instead. When today happens to
            // be a teaching day too, the light "today" treatment is kept but
            // gains a stronger border so the teaching-day signal isn't lost.
            // A day with no class at all stays plain/neutral.
            const todayBorder = isTodayTeaching ? 'border-2 border-blue-600' : 'border border-blue-200';
            const style = isToday
              ? `${todayBorder} bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100`
              : hasClass
              ? 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100';
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay(d)}
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-md"
    >
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
          <Users size={13} /> {course.studentCount} students
        </span>
        <span>Started {formatDate(course.startDate)}</span>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    trainerPortalApi
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

  const stats = data?.stats || { activeCourses: 0, totalStudents: 0, totalAssignments: 0 };
  const schedule = data?.schedule || [];
  const courses = data?.courses || [];

  return (
    <PageContainer title="Dashboard" description="Your teaching overview">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
              <StatCard label="Active Courses" icon={BookOpen} value={loading ? '—' : stats.activeCourses} />
              <StatCard label="Total Students" icon={Users} value={loading ? '—' : stats.totalStudents} />
              <StatCard label="Total Assignments" icon={ClipboardList} value={loading ? '—' : stats.totalAssignments} />
            </div>
            <ScheduleWidget schedule={schedule} loading={loading} onSelectDay={() => navigate('/trainer/calendar')} />
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-base font-semibold text-slate-800">Active Courses</h2>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : courses.length === 0 ? (
              <EmptyState title="No active courses" description="You have no ongoing batches assigned right now." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.batchId} course={course} onClick={() => navigate(`/trainer/courses/${course.batchId}`)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
