import { useState } from 'react';
import { Clock, Search, User } from 'lucide-react';
import { Input, Button, StatusBadge } from '../common';
import attendanceApi from '../../api/attendanceApi';
import { resolveFileUrl } from '../../utils/fileUrl';

// Roll-number search + student preview card, shared by the Super Admin
// combined Attendance page and the Admin "Mark Attendance" page.
// `campusFilter` (Admin Portal's Campus Selector) scopes the search so it
// never surfaces a student enrolled at a different campus — undefined for
// Super Admin, so its search is unaffected.
export default function RollNumberLookup({ campusFilter }) {
  const [rollNumber, setRollNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!rollNumber.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const data = await attendanceApi.lookup(rollNumber.trim(), undefined, campusFilter);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.message || 'No student found for this roll number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Roll Number Lookup</h2>
      <form onSubmit={handleSearch} className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Enter roll number"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            {result.student?.profilePicture ? (
              <img
                src={resolveFileUrl(result.student.profilePicture)}
                alt=""
                loading="lazy"
                decoding="async"
                width={48}
                height={48}
                className="h-12 w-12 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <User size={20} />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-800">{result.student?.user?.name}</p>
              <p className="text-xs text-slate-500">{result.student?.user?.email}</p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Course</p>
              <p className="text-slate-700">{result.enrollment?.course?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Batch</p>
              <p className="text-slate-700">{result.enrollment?.batch?.batchCode || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Enrollment Status</p>
              <StatusBadge status={result.enrollment?.status} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Payment Status</p>
              <StatusBadge status={result.paymentStatus} />
            </div>
          </div>

          <div className="mb-3 flex items-center gap-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Clock size={13} /> Attendance: {result.attendanceSummary?.percentPresent ?? 0}% present
            </span>
            <span>Present {result.attendanceSummary?.counts.present || 0}</span>
            <span>Absent {result.attendanceSummary?.counts.absent || 0}</span>
            <span>Late {result.attendanceSummary?.counts.late || 0}</span>
            <span>Leave {result.attendanceSummary?.counts.leave || 0}</span>
          </div>

          {result.recentAttendance?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Recent Attendance</p>
              <ul className="space-y-1 text-xs text-slate-500">
                {result.recentAttendance.map((a) => (
                  <li key={a._id} className="flex items-center justify-between">
                    <span>{new Date(a.date).toLocaleDateString()}</span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {searched && !result && !loading && !error && (
        <p className="py-4 text-center text-sm text-slate-400">No results</p>
      )}
    </div>
  );
}
