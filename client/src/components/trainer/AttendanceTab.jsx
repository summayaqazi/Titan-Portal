import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, UserMinus } from 'lucide-react';
import { Input, EmptyState, StatusBadge, StatPill } from '../common';
import trainerPortalApi from '../../api/trainerPortalApi';
import { getErrorMessage } from '../../utils/errors';

const today = () => new Date().toISOString().slice(0, 10);

// Read-only: date picker + statistics + roster table. Trainers view
// attendance only — marking/updating is an Admin/Super Admin action, never
// exposed here (no mark endpoint is even reachable for this role, not just
// hidden in this UI).
export default function AttendanceTab({ batchId }) {
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    trainerPortalApi
      .getAttendanceRoster(batchId, date)
      .then((res) => {
        if (!cancelled) setRoster(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load roster'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, date]);

  const stats = {
    total: roster.length,
    present: roster.filter((r) => r.status === 'present' || r.status === 'late').length,
    leave: roster.filter((r) => r.status === 'leave').length,
    absent: roster.filter((r) => r.status === 'absent').length,
  };

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="attendance-date" className="mb-1.5 block text-sm font-medium text-slate-700">
          Select a Date
        </label>
        <Input id="attendance-date" type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill icon={Users} label="Total Students" value={stats.total} colorClass="bg-blue-50 text-blue-600" />
        <StatPill icon={UserCheck} label="Present" value={stats.present} colorClass="bg-green-50 text-green-600" />
        <StatPill icon={UserMinus} label="Leave" value={stats.leave} colorClass="bg-amber-50 text-amber-600" />
        <StatPill icon={UserX} label="Absent" value={stats.absent} colorClass="bg-red-50 text-red-600" />
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading roster…</p>
      ) : roster.length === 0 ? (
        <EmptyState title="No enrolled students found in this batch" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Roll #</th>
                <th className="px-4 py-3 font-medium">Full Name</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((r) => (
                <tr key={r.enrollment} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{r.rollNumber || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.studentName}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status ? (
                      <StatusBadge status={r.status} />
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        Not Marked
                      </span>
                    )}
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
