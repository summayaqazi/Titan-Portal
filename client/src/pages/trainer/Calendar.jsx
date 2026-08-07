import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageContainer, Button } from '../../components/common';
import trainerPortalApi from '../../api/trainerPortalApi';
import { getErrorMessage } from '../../utils/errors';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildMonthGrid(year, month) {
  // month is 1-12. Grid starts on Sunday, per the Slot day-code convention
  // (Sun..Sat) already used server-side.
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Calendar() {
  const navigate = useNavigate();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    trainerPortalApi
      .getCalendar(month, year)
      .then((res) => {
        if (!cancelled) setEvents(res.events || []);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load calendar'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const day = Number(e.date.slice(-2));
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(e);
    });
    return map;
  }, [events]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const goPrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  return (
    <PageContainer
      title="Calendar"
      description="Your teaching schedule"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={goPrev} aria-label="Previous month">
            <ChevronLeft size={16} />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-slate-700">
            {MONTH_LABELS[month - 1]} {year}
          </span>
          <Button variant="secondary" onClick={goNext} aria-label="Next month">
            <ChevronRight size={16} />
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dayEvents = day ? eventsByDate.get(day) || [] : [];
              return (
                <div
                  key={i}
                  className={`min-h-[6.5rem] border-b border-r border-slate-100 p-1.5 last:border-r-0 ${
                    day ? '' : 'bg-slate-50/50'
                  }`}
                >
                  {day && (
                    <>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          isToday(day) ? 'bg-blue-600 font-semibold text-white' : 'text-slate-600'
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 3).map((e, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => navigate(`/trainer/courses/${e.batchId}`)}
                            title={`${e.courseName} (${e.batchCode}) — ${e.startTime}-${e.endTime}`}
                            className="block w-full truncate rounded bg-blue-50 px-1.5 py-0.5 text-left text-[11px] text-blue-700 hover:bg-blue-100"
                          >
                            {e.startTime} {e.courseName}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="px-1.5 text-[11px] text-slate-400">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {loading && <p className="mt-3 text-sm text-slate-400">Loading…</p>}
    </PageContainer>
  );
}
