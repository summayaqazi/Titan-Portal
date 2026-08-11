import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, MapPin, Clock, Hash, User as UserIcon, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { PageContainer, EmptyState, StatusBadge } from '../../components/common';
import TopicStatCards from '../../components/student/TopicStatCards';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';
import { themeForCourse, progressBarColor } from '../../utils/courseTheme';

// `course` merges getProgress() (modules/topics/progressPercent/courseCode/
// totalTopics/completedTopics/remainingTopics) with the matching entry from
// getDashboard()'s own `courses` (batchCode/campus/city/slot/rollNumber/
// trainerName/status) — two existing endpoints the Student Portal already
// calls elsewhere, joined client-side by enrollmentId. No new/changed
// backend endpoint, no second progress calculation — every number here is
// exactly what getProgress() already computed server-side.
//
// Styled to match the Dashboard's own CourseCard (same header band/border/
// footer-row language) with one addition — the three compact topic-stat
// boxes — so this page reads as part of the same app instead of a
// one-off design. The whole card links to the existing Course Details page
// (/student/courses/:enrollmentId, same route/component the Dashboard's
// own course cards already use) instead of expanding in place — that page
// already renders the full module/topic breakdown, so nothing is
// duplicated here.
function CourseProgressCard({ course }) {
  const theme = themeForCourse(course.courseId || course.courseName);
  return (
    <Link
      to={`/student/courses/${course.enrollmentId}`}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border ${theme.border} bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.hoverBorder}`}
    >
      <div className={`${theme.bg} px-5 py-3`}>
        <div className="flex items-start justify-between gap-3">
          <p className={`text-base font-bold leading-snug ${theme.heading}`}>{course.courseName}</p>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            {course.courseCode || course.batchCode || '—'}
          </span>
        </div>
        {course.campus && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin size={12} /> {course.campus}
            {course.city ? `, ${course.city}` : ''}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-4 pt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span className="font-medium">Overall Progress</span>
          <span className="text-base font-bold text-slate-800">{course.progressPercent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarColor(course.progressPercent)}`}
            style={{ width: `${course.progressPercent}%` }}
          />
        </div>

        <div className="mt-3">
          <TopicStatCards total={course.totalTopics} completed={course.completedTopics} pending={course.remainingTopics} />
        </div>

        {(course.slot || course.rollNumber || course.trainerName || course.status) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
            {course.slot && (
              <p className="flex items-center gap-1.5">
                <Clock size={13} className="shrink-0" />
                {course.slot.label} · {course.slot.startTime}–{course.slot.endTime}
              </p>
            )}
            {course.rollNumber && (
              <p className="flex items-center gap-1.5">
                <Hash size={13} className="shrink-0" /> Roll: <span className="font-medium text-slate-800">{course.rollNumber}</span>
              </p>
            )}
            {course.trainerName && (
              <p className="flex items-center gap-1.5">
                <UserIcon size={13} className="shrink-0" /> <span className="font-medium text-slate-800">{course.trainerName}</span>
              </p>
            )}
            {course.status && <StatusBadge status={course.status} />}
          </div>
        )}
      </div>
    </Link>
  );
}

// Small icon + value/label chip, same rounded-lg/soft-background language as
// TopicStatCards and the Dashboard's own StatCard — used for the aggregate
// "Progress Overview" row below. Every value passed in is a plain sum/
// average over the exact same `courses` array the cards above render from
// (getProgress()'s own totalTopics/completedTopics/remainingTopics), so
// this section can never disagree with the cards above it.
function OverviewStat({ icon: Icon, label, value, iconWrap, valueColor }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold leading-none ${valueColor}`}>{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// Compact per-course row for the "Course Progress" comparison list —
// deliberately smaller than the big cards above (no header band, no
// campus/schedule/roll/trainer footer) so a student can scan every active
// course's numbers side by side without re-reading the same detail twice.
// Same fields as the big card (progressPercent/completedTopics/totalTopics/
// remainingTopics), same destination on click.
function CourseProgressRow({ course }) {
  return (
    <Link
      to={`/student/courses/${course.enrollmentId}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-800">{course.courseName}</p>
        <span className="shrink-0 text-sm font-bold text-slate-800">{course.progressPercent}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressBarColor(course.progressPercent)}`}
          style={{ width: `${course.progressPercent}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          <span className="font-semibold text-slate-700">
            {course.completedTopics}/{course.totalTopics}
          </span>{' '}
          Completed
        </span>
        <span className="font-semibold text-orange-600">{course.remainingTopics} Pending</span>
      </div>
    </Link>
  );
}

export default function Progress() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([studentPortalApi.getProgress(), studentPortalApi.getDashboard()])
      .then(([progressCourses, dashboard]) => {
        if (cancelled) return;
        const dashboardByEnrollment = new Map((dashboard.courses || []).map((c) => [String(c.enrollmentId), c]));
        setCourses(
          progressCourses.map((course) => {
            const enriched = dashboardByEnrollment.get(String(course.enrollmentId));
            // Only pull in the fields getProgress() doesn't already have
            // (batch/campus/schedule/roll number/trainer/status) — every
            // progress-derived field (courseName, progressPercent, modules,
            // totalTopics/completedTopics/remainingTopics, etc.) stays
            // exactly what getProgress() returned, untouched.
            return {
              ...course,
              batchCode: enriched?.batchCode,
              campus: enriched?.campus,
              city: enriched?.city,
              slot: enriched?.slot,
              rollNumber: enriched?.rollNumber,
              trainerName: enriched?.trainerName,
              status: enriched?.status,
            };
          })
        );
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load progress'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Plain aggregate over the same `courses` array the cards above already
  // render from — no separate fetch, no re-derivation of any per-course
  // number, just totals/an average across what getProgress() returned.
  const totalTopics = courses.reduce((sum, c) => sum + (c.totalTopics || 0), 0);
  const completedTopics = courses.reduce((sum, c) => sum + (c.completedTopics || 0), 0);
  const pendingTopics = courses.reduce((sum, c) => sum + (c.remainingTopics || 0), 0);
  const overallPercent = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <PageContainer title="Progress" description="Track your course completion, module by module">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No Active Courses"
          description="You are not enrolled in any active course yet."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {courses.map((course) => (
              <CourseProgressCard key={course.enrollmentId} course={course} />
            ))}
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Progress Overview</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <OverviewStat
                icon={BookOpen}
                label="Total Courses"
                value={courses.length}
                iconWrap="bg-violet-50 text-violet-600"
                valueColor="text-violet-700"
              />
              <OverviewStat
                icon={Layers}
                label="Total Topics"
                value={totalTopics}
                iconWrap="bg-primary-50 text-primary-600"
                valueColor="text-primary-700"
              />
              <OverviewStat
                icon={CheckCircle2}
                label="Completed Topics"
                value={completedTopics}
                iconWrap="bg-emerald-50 text-emerald-600"
                valueColor="text-emerald-700"
              />
              <OverviewStat
                icon={Clock}
                label="Pending Topics"
                value={pendingTopics}
                iconWrap="bg-orange-50 text-orange-600"
                valueColor="text-orange-700"
              />
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Overall Progress</span>
                <span className="text-base font-bold text-slate-800">{overallPercent}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressBarColor(overallPercent)}`}
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Course Progress</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {courses.map((course) => (
                <CourseProgressRow key={course.enrollmentId} course={course} />
              ))}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
