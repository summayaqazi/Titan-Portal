import { useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { PageContainer, StatusBadge, Table, Select } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Last 12 calendar months (this month first), "" = All — same shape/order a
// simple reporting-period filter needs, no date-picker component required.
function buildMonthOptions() {
  const options = [{ value: '', label: 'All time' }];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  return options;
}
const MONTH_OPTIONS = buildMonthOptions();

function overviewMessage(percent) {
  if (percent >= 85) return { text: 'Good standing — keep it up.', className: 'text-green-600' };
  if (percent >= 70) return { text: 'Acceptable, but room to improve.', className: 'text-amber-600' };
  return { text: 'At risk — attendance is below the recommended threshold.', className: 'text-red-600' };
}

export default function Attendance() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    studentPortalApi
      .getAttendance(month)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load attendance'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const stats = data?.stats || { total: 0, present: 0, leave: 0, absent: 0, late: 0, percentPresent: 0 };
  const details = data?.details || [];
  const message = overviewMessage(stats.percentPresent);

  return (
    <PageContainer
      title="Attendance"
      description="Your attendance record across all enrolled courses"
      actions={
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto">
          {MONTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      }
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Classes" icon={CalendarCheck} value={loading ? '—' : stats.total} />
            <StatCard
              label="Present"
              icon={CheckCircle2}
              value={loading ? '—' : stats.present + stats.late}
              iconClassName="bg-green-50 text-green-600"
              valueClassName="text-green-600"
            />
            <StatCard
              label="Leave"
              icon={Clock3}
              value={loading ? '—' : stats.leave}
              iconClassName="bg-amber-50 text-amber-600"
              valueClassName="text-amber-600"
            />
            <StatCard
              label="Absent"
              icon={XCircle}
              value={loading ? '—' : stats.absent}
              iconClassName="bg-red-50 text-red-600"
              valueClassName="text-red-600"
            />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Attendance Overview</span>
              <span className="text-lg font-semibold text-slate-800">{loading ? '—' : `${stats.percentPresent}%`}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${stats.percentPresent}%` }} />
            </div>
            {!loading && <p className={`mt-2 text-xs font-medium ${message.className}`}>{message.text}</p>}
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-base font-semibold text-slate-800">Attendance Details</h2>
            <Table
              emptyMessage={loading ? 'Loading…' : 'No attendance records found'}
              columns={[
                { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
                { key: 'courseName', header: 'Course', render: (row) => row.courseName || '—' },
                { key: 'batchCode', header: 'Batch', render: (row) => row.batchCode || '—' },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              ]}
              data={loading ? [] : details}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
