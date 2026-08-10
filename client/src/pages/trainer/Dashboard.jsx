import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, ClipboardList, Clock, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import { PageContainer, EmptyState } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import trainerPortalApi from '../../api/trainerPortalApi';
import { getErrorMessage } from '../../utils/errors';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Cosmetic per-card accent, cycling by position — same data, same course,
// just a bit of the color variety a plain repeated white card lacks.
// Reference layout for the 3 summary cards: value on top, label below, icon
// as a circle pinned to the right — achieved via StatCard's iconWrapClassName
// (circle instead of the default square) + flex-row-reverse (visually swaps
// icon/text sides without touching DOM order) + flex-col-reverse on the text
// block (visually swaps label/value order). Colors/icons/data untouched.
// pb (not py) is the taller value on purpose — with `items-start` on the
// row (see below) these cards' top edge already lines up with Teaching
// Schedule's top edge, so growing the bottom padding only extends the card
// downward toward Teaching Schedule's height instead of also pushing the
// top edge/content upward.
const STAT_CARD_SHELL =
  'flex flex-row-reverse items-center justify-between gap-3 rounded-2xl bg-white px-5 pt-4 pb-12 shadow-sm transition-shadow duration-200 hover:shadow-md';
const STAT_ICON_WRAP = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full';
const STAT_TEXT_WRAP = 'flex min-w-0 flex-col-reverse gap-0.5';
const STAT_VALUE_EXTRA = 'leading-none';
const STAT_LABEL_EXTRA = 'text-slate-500 leading-none';

// bg is one step darker than before (-50/60 -> -100/70) — same hues, just a
// bit more visible per the "slightly darker" request.
const CARD_THEMES = [
  { bg: 'bg-primary-100/70', border: 'border-primary-100', hoverBorder: 'hover:border-primary-300', bar: 'bg-primary-600', heading: 'text-primary-700' },
  { bg: 'bg-emerald-100/70', border: 'border-emerald-100', hoverBorder: 'hover:border-emerald-300', bar: 'bg-emerald-600', heading: 'text-emerald-700' },
  { bg: 'bg-violet-100/70', border: 'border-violet-100', hoverBorder: 'hover:border-violet-300', bar: 'bg-violet-600', heading: 'text-violet-700' },
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

// "14:05" -> "02:05 PM" — display formatting only, the stored value is
// untouched.
function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = String(h % 12 || 12).padStart(2, '0');
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// A slot has one shared start/end time across all its days, so the time
// only needs to be shown once — consecutive days collapse into a "Mon–Fri"
// range (falling back to a comma list for a non-consecutive spread like
// Tue/Thu) instead of repeating the same time per day.
function formatDayRange(days) {
  const order = DAY_ABBR;
  const idxs = [...days].map((d) => order.indexOf(d)).filter((i) => i >= 0).sort((a, b) => a - b);
  const ranges = [];
  let start = idxs[0];
  let prev = idxs[0];
  for (let i = 1; i <= idxs.length; i++) {
    const cur = idxs[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? order[start] : `${order[start]}–${order[prev]}`);
    start = cur;
    prev = cur;
  }
  return ranges.join(', ');
}

function scheduleText(slot) {
  if (!slot) return 'No slot assigned';
  const time = `${formatTime12(slot.startTime)} – ${formatTime12(slot.endTime)}`;
  const days = slot.days?.length ? formatDayRange(slot.days) : slot.label;
  return `${days} · ${time}`;
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

  // Grouped by date (not just a Set) so the tooltip can name the actual
  // class(es) + time(s) on a teaching day instead of a generic "has a
  // class" — same underlying schedule data, just read more of it.
  const classesByDate = schedule.reduce((map, item) => {
    (map[item.date] ||= []).push(item);
    return map;
  }, {});

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CalendarIcon size={16} className="text-primary-600" /> Teaching Schedule
      </h2>
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="flex gap-2">
          {days.map((d) => {
            const key = localDateKey(d);
            const isToday = key === localDateKey(today);
            const dayClasses = classesByDate[key] || [];
            const hasClass = dayClasses.length > 0;
            const tooltip = hasClass
              ? dayClasses.map((c) => `${c.courseName} · ${c.startTime}–${c.endTime}`).join('\n')
              : 'No class scheduled';
            // Today keeps its solid blue ring (unchanged); a class day gets
            // a soft/semi-transparent light-green fill instead — distinct
            // signals that stay independently readable even when a day is
            // both. A day with neither stays plain neutral gray.
            const pillClass = isToday
              ? 'border-2 border-primary-600 bg-primary-50 text-primary-900 shadow-sm hover:bg-primary-100'
              : hasClass
              ? 'border border-emerald-200 bg-emerald-100/60 text-emerald-700 hover:bg-emerald-100'
              : 'border border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100';
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay(d)}
                title={tooltip}
                className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2.5 text-[11px] font-medium transition-colors ${pillClass}`}
              >
                <span className="tracking-tight opacity-70">{DAY_ABBR[d.getDay()]}</span>
                <span className="text-base font-bold">{d.getDate()}</span>
                {isToday && hasClass && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, index, onClick }) {
  const theme = CARD_THEMES[index % CARD_THEMES.length];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border ${theme.border} bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${theme.hoverBorder}`}
    >
      {/* Header band: title + campus line both get the theme tint, so the
          highlight extends naturally down through the campus row instead of
          stopping at the title — the card body below stays plain white and
          visually separate. */}
      <div className={`${theme.bg} px-5 py-3`}>
        <div className="flex items-start justify-between gap-3">
          <p className={`text-base font-bold leading-snug ${theme.heading}`}>{course.courseName}</p>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            {course.batchCode}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin size={12} /> {course.campus}
        </p>
      </div>

      <div className="px-5 pb-4 pt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span>Progress</span>
          <span className="font-semibold text-slate-800">{course.progress}% Completed</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${course.progress}%` }} />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
          <p className="flex items-center gap-1.5">
            <Users size={13} className="shrink-0" /> Enrolled: <span className="font-medium text-slate-800">{course.studentCount} students</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Clock size={13} className="shrink-0" /> Schedule: <span className="font-medium text-slate-800">{scheduleText(course.slot)}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <CalendarIcon size={13} className="shrink-0" /> Started On: <span className="font-medium text-slate-800">{formatDate(course.startDate)}</span>
          </p>
        </div>
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
    <PageContainer
      title="Dashboard"
      description="Your teaching overview"
      className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-2"
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          {/* items-start: CSS Grid's default stretch was forcing the stat
              cards to match the taller Teaching Schedule card's height in
              this row — that (not padding) was the real cause of the
              "boxy" look. Without stretch, each card sizes to its own
              (short) content instead. */}
          {/* lg:grid-cols-3 + col-span-2 (was cols-4/col-span-3): the 1/4
              share left the schedule card only ~22px per day pill — less
              than the "Mon"/"Wed" text itself needs (measured ~23px),
              so labels were silently overflowing their pills. 1/3 gives
              enough width for properly padded pills without starving the
              (single-line, much less space-hungry) stat cards. */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
            {/* sm:grid-cols-2 (not 3) — 3-up at tablet widths left too
                little room per card and truncated labels like "Total
                Assignments"; lg:grid-cols-3 restores 3-up once there's
                enough width (this row is the full content width below lg,
                sharing with the schedule only at lg+). */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
              <StatCard
                label="Active Courses"
                icon={BookOpen}
                value={loading ? '—' : stats.activeCourses}
                valueClassName={`text-[#2877B9] ${STAT_VALUE_EXTRA}`}
                labelClassName={STAT_LABEL_EXTRA}
                iconClassName="bg-violet-50 text-violet-600"
                className={STAT_CARD_SHELL}
                iconWrapClassName={STAT_ICON_WRAP}
                textWrapClassName={STAT_TEXT_WRAP}
              />
              <StatCard
                label="Total Students"
                icon={Users}
                value={loading ? '—' : stats.totalStudents}
                valueClassName={`text-[#2877B9] ${STAT_VALUE_EXTRA}`}
                labelClassName={STAT_LABEL_EXTRA}
                iconClassName="bg-emerald-50 text-emerald-600"
                className={STAT_CARD_SHELL}
                iconWrapClassName={STAT_ICON_WRAP}
                textWrapClassName={STAT_TEXT_WRAP}
              />
              <StatCard
                label="Total Assignments"
                icon={ClipboardList}
                value={loading ? '—' : stats.totalAssignments}
                valueClassName={`text-[#2877B9] ${STAT_VALUE_EXTRA}`}
                labelClassName={STAT_LABEL_EXTRA}
                iconClassName="bg-orange-50 text-orange-600"
                className={STAT_CARD_SHELL}
                iconWrapClassName={STAT_ICON_WRAP}
                textWrapClassName={STAT_TEXT_WRAP}
              />
            </div>
            <ScheduleWidget schedule={schedule} loading={loading} onSelectDay={() => navigate('/trainer/calendar')} />
          </div>

          <div className="mt-4">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Active Courses</h2>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : courses.length === 0 ? (
              <EmptyState title="No active courses" description="You have no ongoing batches assigned right now." />
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {courses.map((course, index) => (
                  <CourseCard
                    key={course.batchId}
                    course={course}
                    index={index}
                    onClick={() => navigate(`/trainer/courses/${course.batchId}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
