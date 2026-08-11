import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  ClipboardList,
  BookOpen,
  TrendingUp,
  Clock,
  MapPin,
  User as UserIcon,
  Hash,
  Calendar as CalendarIcon,
  MessageSquarePlus,
  FileQuestion,
  Wallet,
} from 'lucide-react';
import { PageContainer, EmptyState, Button, StatusBadge } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import FeedbackModal from '../../components/student/FeedbackModal';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';
import { themeForCourse, progressBarColor } from '../../utils/courseTheme';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Same labels/derivation as the full Payments page (Payments.jsx) — kept
// page-local rather than shared, same convention that page's own comment
// already documents for this exact lookup.
const FEE_TYPE_LABELS = {
  registration: 'Registration Fee',
  monthly: 'Monthly Fee',
  installment: 'Installment',
};

function formatFeeMonth(row) {
  const source = row.month ? `${row.month}-01` : row.dueDate;
  if (!source) return '—';
  return new Date(source).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

// Stat-card shell copied at the same dimensions as the Trainer dashboard's
// own (value on top, label below, icon as a small circle pinned to the
// right, pb-12 so the card's bottom edge reaches down toward the taller
// Schedule card without stretching its top edge) — explicitly requested to
// match Trainer's proportions exactly rather than being "bigger/premium".
// Same StatCard component, just different className props — no shared
// file touched, so Trainer/other portals are unaffected.
const STAT_CARD_SHELL =
  'flex flex-row-reverse items-center justify-between gap-3 rounded-2xl bg-white px-5 pt-4 pb-12 shadow-sm transition-shadow duration-200 hover:shadow-md';
const STAT_ICON_WRAP = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full';
const STAT_TEXT_WRAP = 'flex min-w-0 flex-col-reverse gap-0.5';
const STAT_VALUE_EXTRA = 'leading-none';
const STAT_LABEL_EXTRA = 'text-slate-500 leading-none';

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Compact current-week strip (Sun–Sat) — same footprint as the Trainer
// dashboard's Teaching Schedule (day-pill row only), plus a single-line
// "Today's Class" strip underneath instead of the old multi-line boxed
// panel — enough to surface today's class without the card growing tall
// enough to visibly outgrow the stat-card row next to it. Day-pill
// coloring mirrors Trainer's: a class day gets a soft, semi-transparent
// pastel-green fill (not a solid color) and today keeps the stronger blue
// ring — independently readable signals, same as Trainer's. Each day pill
// still carries the full class list in its hover tooltip. Purely a
// color/spacing pass — the schedule data/derivation is untouched.
function ScheduleWidget({ schedule, loading }) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const classesByDate = schedule.reduce((map, item) => {
    (map[item.date] ||= []).push(item);
    return map;
  }, {});
  const todayKey = localDateKey(today);
  const todayClasses = classesByDate[todayKey] || [];

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CalendarIcon size={16} className="text-primary-600" /> Class Schedule
      </h2>
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="flex gap-1.5">
            {days.map((d) => {
              const key = localDateKey(d);
              const isToday = key === todayKey;
              const dayClasses = classesByDate[key] || [];
              const hasClass = dayClasses.length > 0;
              const tooltip = hasClass
                ? dayClasses.map((c) => `${c.courseName} · ${c.startTime}–${c.endTime}`).join('\n')
                : 'No class scheduled';
              // Today always wins with the stronger blue ring (matches
              // Trainer's "today" pill exactly); a class day that isn't
              // today gets the soft pastel-green treatment instead of a
              // solid fill; a plain day stays neutral gray.
              const style = isToday
                ? 'border-2 border-primary-600 bg-primary-50 text-primary-900 shadow-sm hover:bg-primary-100'
                : hasClass
                ? 'border border-emerald-200 bg-emerald-100/60 text-emerald-700 hover:bg-emerald-100'
                : 'border border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100';
              return (
                <div
                  key={key}
                  title={tooltip}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-colors ${style}`}
                >
                  <span className="tracking-tight opacity-70">{DAY_ABBR[d.getDay()]}</span>
                  <span className="text-sm font-semibold">{d.getDate()}</span>
                  <span
                    className={`h-1 w-1 rounded-full ${
                      !hasClass ? 'bg-transparent' : isToday ? 'bg-primary-600' : 'bg-emerald-600'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-2 border-t border-slate-100 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-600">Today's Class</p>
            {todayClasses.length === 0 ? (
              <p className="mt-0.5 text-xs text-slate-400">No class scheduled today.</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {todayClasses.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-slate-600">
                    <span className="truncate font-medium text-slate-800">{c.courseName}</span>
                    <span className="shrink-0 text-slate-400">
                      · {c.startTime}–{c.endTime} · {formatShortDate(c.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Phase 6 — the whole card links into Course Details (roll number/campus/
// city/schedule/curriculum for this one enrollment). Restyled to match the
// Trainer dashboard's course-card language (tinted header band, white
// batch-code pill, footer info row) while keeping strictly student-facing
// fields — no "Enrolled: N students" (that's Trainer-only info); roll
// number/trainer/schedule/status stand in its place. Same underlying data
// as before (`city`/`status` already returned by the backend). `theme` still
// colors the card's own header band/border (decorative, per-course, via the
// shared `themeForCourse` — same as the Progress page); the progress bar's
// fill is separate and follows completion status instead (green once done,
// blue otherwise — Trainer's own rule, see progressBarColor above).
// `course.slot.days` is the same enum array ('Mon'..'Sun') the Slot model
// already stores and getDashboard() already passes through untouched — just
// sorted into calendar-week order (slots aren't guaranteed to be stored
// Mon-first) and joined for display. No new field, no invented days.
function formatSlotDays(days) {
  if (!days?.length) return '';
  return [...days].sort((a, b) => DAY_ABBR.indexOf(a) - DAY_ABBR.indexOf(b)).join(', ');
}

function CourseCard({ course }) {
  const theme = themeForCourse(course.courseId || course.courseName);
  const slotDays = formatSlotDays(course.slot?.days);
  return (
    <Link
      to={`/student/courses/${course.enrollmentId}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border ${theme.border} bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${theme.hoverBorder}`}
    >
      <div className={`${theme.bg} px-5 py-3`}>
        <div className="flex items-start justify-between gap-3">
          <p className={`text-base font-bold leading-snug ${theme.heading}`}>{course.courseName}</p>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            {course.batchCode}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin size={12} /> {course.campus}
          {course.city ? `, ${course.city}` : ''}
        </p>
      </div>

      <div className="px-5 pb-4 pt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span>Progress</span>
          <span className="font-semibold text-slate-800">{course.progress}% Completed</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarColor(course.progress)}`}
            style={{ width: `${course.progress}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
          <p className="flex items-center gap-1.5">
            <Clock size={13} className="shrink-0" />
            {course.slot
              ? `${course.slot.label} · ${slotDays ? `${slotDays} · ` : ''}${course.slot.startTime}–${course.slot.endTime}`
              : 'No slot assigned'}
          </p>
          <p className="flex items-center gap-1.5">
            <Hash size={13} className="shrink-0" /> Roll: <span className="font-medium text-slate-800">{course.rollNumber || '—'}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <UserIcon size={13} className="shrink-0" /> <span className="font-medium text-slate-800">{course.trainerName || 'Unassigned'}</span>
          </p>
          {course.status && <StatusBadge status={course.status} />}
        </div>
      </div>
    </Link>
  );
}

// Compact "needs action" view onto the existing Assignments/Quizzes pages —
// same fields those pages already fetch and display in full, just filtered
// down to what the student hasn't dealt with yet and capped to a handful
// of rows. No new backend endpoint: reuses getAssignments()/getQuizzes() as-is.
function UpcomingPanel({ assignments, quizzes, loading }) {
  const [tab, setTab] = useState('assignments');

  // "Needs action" subset: an assignment already submitted or past its
  // deadline isn't upcoming anymore; a quiz already attempted (any status
  // other than 'pending') isn't either.
  const upcomingAssignments = assignments.filter((a) => !a.submission && !a.expired).slice(0, 4);
  const upcomingQuizzes = quizzes.filter((q) => q.status === 'pending').slice(0, 4);

  const tabs = [
    { key: 'assignments', label: 'Assignments', count: upcomingAssignments.length, viewAllPath: '/student/assignments' },
    { key: 'quizzes', label: 'Quizzes', count: upcomingQuizzes.length, viewAllPath: '/student/quizzes' },
  ];
  const activeTab = tabs.find((t) => t.key === tab);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileQuestion size={15} className="text-primary-600" /> Upcoming
        </h2>
        <Link to={activeTab.viewAllPath} className="text-xs font-medium text-primary-600 hover:underline">
          View all
        </Link>
      </div>

      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : tab === 'assignments' ? (
        upcomingAssignments.length === 0 ? (
          <p className="text-xs text-slate-400">No upcoming assignments</p>
        ) : (
          <ul className="space-y-2">
            {upcomingAssignments.map((a) => (
              <li key={a._id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-700">{a.title}</p>
                  <p className="truncate text-slate-400">{a.courseName}</p>
                </div>
                <span className="shrink-0 text-slate-500">Due {formatDate(a.dueDate)}</span>
              </li>
            ))}
          </ul>
        )
      ) : upcomingQuizzes.length === 0 ? (
        <p className="text-xs text-slate-400">No upcoming quizzes</p>
      ) : (
        <ul className="space-y-2">
          {upcomingQuizzes.map((q) => (
            <li key={q._id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700">{q.title}</p>
                <p className="truncate text-slate-400">{q.courseName}</p>
              </div>
              <span className="shrink-0 text-slate-500">
                {q.totalQuestions} Qs · {q.durationMinutes} min
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Compact view onto the existing Payments page — same fields/statuses that
// page's own Table shows in full (Month/Amount/Type/Due Date/Voucher
// ID/Status), just the top few rows (overdue and pending surfaced first,
// so this reads as "what needs attention" not just "most recent"). No new
// backend endpoint: reuses getPayments() as-is.
function FeeSummaryPanel({ payments, loading }) {
  const statusWeight = (p) => (p.status === 'overdue' ? 0 : p.status === 'pending' ? 1 : 2);
  const topPayments = [...payments].sort((a, b) => statusWeight(a) - statusWeight(b)).slice(0, 4);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Wallet size={15} className="text-primary-600" /> Fee Summary
        </h2>
        <Link to="/student/payments" className="text-xs font-medium text-primary-600 hover:underline">
          View all
        </Link>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : topPayments.length === 0 ? (
        <p className="text-xs text-slate-400">No payment records found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Due Date</th>
                <th className="pb-2 font-medium">Voucher ID</th>
                <th className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {topPayments.map((p) => (
                <tr key={p._id} className="border-t border-slate-100">
                  <td className="py-2 text-slate-600">{formatFeeMonth(p)}</td>
                  <td className="py-2 font-medium text-slate-700">PKR {p.amount?.toLocaleString()}</td>
                  <td className="py-2 text-slate-600">{FEE_TYPE_LABELS[p.feeType] || p.feeType}</td>
                  <td className="py-2 text-slate-600">{formatDate(p.dueDate)}</td>
                  <td className="py-2 font-mono text-slate-500">{p.invoiceNumber || '—'}</td>
                  <td className="py-2 text-right">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Upcoming/Fee Summary panels' data — fetched independently of the main
  // dashboard payload (own loading flag, own try/catch) so a failure here
  // never blanks out the stat cards/schedule/courses above; reuses the
  // existing Assignments/Quizzes/Payments endpoints as-is, same data those
  // full pages already show.
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [extrasLoading, setExtrasLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    setExtrasLoading(true);
    Promise.allSettled([studentPortalApi.getAssignments(), studentPortalApi.getQuizzes(), studentPortalApi.getPayments()]).then(
      ([assignmentsRes, quizzesRes, paymentsRes]) => {
        if (cancelled) return;
        if (assignmentsRes.status === 'fulfilled') setAssignments(assignmentsRes.value);
        if (quizzesRes.status === 'fulfilled') setQuizzes(quizzesRes.value);
        if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value);
        setExtrasLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data?.stats || {
    enrolledCourses: 0,
    attendancePresent: 0,
    attendanceTotal: 0,
    assignmentsCompleted: 0,
    assignmentsTotal: 0,
    overallProgressPercent: 0,
  };
  const schedule = data?.schedule || [];
  // Active Courses renders in the reverse of getDashboard()'s own order
  // (most-recently-enrolled first) — a plain, course-name-agnostic reversal
  // of whatever the API already returned, not a new sort keyed on any
  // specific course. Every other consumer of `data` (stats, schedule) still
  // reads its own untouched field, so this only changes which position each
  // CourseCard renders in below.
  const courses = [...(data?.courses || [])].reverse();

  return (
    <PageContainer
      title="Dashboard"
      description="Your learning overview"
      className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-2"
      actions={
        <Button variant="secondary" onClick={() => setFeedbackOpen(true)}>
          <MessageSquarePlus size={15} /> Feedback
        </Button>
      }
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          {/* One unified grid for every major Dashboard section (instead of
              three separate stacked blocks) so `order` can actually control
              mobile/tablet stacking order across ALL of them, not just
              within the old top row. `order-*` on each section sets the
              real mobile/tablet render order (stats, Active Courses,
              Upcoming/Fee, Class Schedule LAST) — `lg:order-none` +
              explicit `lg:col-span-*`/`lg:row-start-*` on each section then
              reproduce the exact original desktop grid (stat cards + Class
              Schedule side by side in row 1, Active Courses full-width in
              row 2, Upcoming/Fee split in row 3), so desktop is unchanged.
              gap-y-4/gap-x-5 match the original mt-4 (16px) inter-section
              spacing and gap-5 (20px) row-1 column spacing exactly. */}
          <div className="grid grid-cols-1 items-start gap-x-5 gap-y-4 lg:grid-cols-3">
            <div className="order-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:order-none lg:col-span-2 lg:row-start-1 lg:grid-cols-3">
              <StatCard
                label="Attendance"
                icon={CalendarCheck}
                value={loading ? '—' : `${stats.attendancePresent}/${stats.attendanceTotal}`}
                valueClassName={`text-primary-700 ${STAT_VALUE_EXTRA}`}
                labelClassName={STAT_LABEL_EXTRA}
                iconClassName="bg-teal-50 text-teal-600"
                className={STAT_CARD_SHELL}
                iconWrapClassName={STAT_ICON_WRAP}
                textWrapClassName={STAT_TEXT_WRAP}
              />
              <StatCard
                label="Assignments"
                icon={ClipboardList}
                value={loading ? '—' : `${stats.assignmentsCompleted}/${stats.assignmentsTotal}`}
                valueClassName={`text-primary-700 ${STAT_VALUE_EXTRA}`}
                labelClassName={STAT_LABEL_EXTRA}
                iconClassName="bg-orange-50 text-orange-600"
                className={STAT_CARD_SHELL}
                iconWrapClassName={STAT_ICON_WRAP}
                textWrapClassName={STAT_TEXT_WRAP}
              />
              <StatCard
                label="Active Courses"
                icon={BookOpen}
                value={loading ? '—' : stats.enrolledCourses}
                valueClassName={`text-primary-700 ${STAT_VALUE_EXTRA}`}
                labelClassName={STAT_LABEL_EXTRA}
                iconClassName="bg-violet-50 text-violet-600"
                className={STAT_CARD_SHELL}
                iconWrapClassName={STAT_ICON_WRAP}
                textWrapClassName={STAT_TEXT_WRAP}
              />
            </div>

            <div className="order-2 lg:order-none lg:col-span-3 lg:row-start-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Active Courses</h2>
                {!loading && courses.length > 0 && (
                  <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <TrendingUp size={13} className="shrink-0 text-primary-600" />
                    Overall Progress
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={`block h-full rounded-full transition-all duration-500 ${progressBarColor(stats.overallProgressPercent)}`}
                        style={{ width: `${stats.overallProgressPercent}%` }}
                      />
                    </span>
                    <span className="font-semibold text-primary-700">{stats.overallProgressPercent}%</span>
                  </span>
                )}
              </div>
              {loading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : courses.length === 0 ? (
                <EmptyState title="No enrolled courses" description="You are not enrolled in any active course yet." />
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {courses.map((course) => (
                    <CourseCard key={course.enrollmentId} course={course} />
                  ))}
                </div>
              )}
            </div>

            <div className="order-3 grid grid-cols-1 gap-4 lg:order-none lg:col-span-3 lg:row-start-3 lg:grid-cols-2">
              <UpcomingPanel assignments={assignments} quizzes={quizzes} loading={extrasLoading} />
              <FeeSummaryPanel payments={payments} loading={extrasLoading} />
            </div>

            <div className="order-4 lg:order-none lg:col-span-1 lg:row-start-1">
              <ScheduleWidget schedule={schedule} loading={loading} />
            </div>
          </div>
        </>
      )}

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </PageContainer>
  );
}
