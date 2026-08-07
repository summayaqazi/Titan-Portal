import { useEffect, useState } from 'react';
import { StatusBadge } from '../common';
import attendanceApi from '../../api/attendanceApi';

// Most-recently-marked attendance feed, shared by the Super Admin combined
// Attendance page and the Admin "View Attendance" page. `campusFilter`
// (Admin Portal's Campus Selector) scopes the feed — undefined for Super
// Admin, so its feed is unaffected.
export default function RecentActivityPanel({ campusFilter }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi
      .recent(10, campusFilter)
      .then(setRecords)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Recent Activity</h2>
      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">Loading…</p>
      ) : records.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No attendance activity yet</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {records.map((r) => (
            <li key={r._id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-700">{r.student?.user?.name || '—'}</p>
                <p className="text-xs text-slate-400">
                  {r.batch?.batchCode} · {new Date(r.date).toLocaleDateString()} · by {r.markedBy?.name || '—'}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
