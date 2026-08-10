import { useEffect, useState } from 'react';
import { CheckCheck, Save } from 'lucide-react';
import { Select, Input, Button } from '../common';
import attendanceApi from '../../api/attendanceApi';

const STATUSES = ['present', 'absent', 'leave', 'late'];
const today = () => new Date().toISOString().slice(0, 10);

// Batch roster + per-student status marking, shared by the Super Admin
// combined Attendance page and the Admin "Mark Attendance" page.
export default function MarkAttendancePanel({ batches, onMarked, canMark }) {
  const [batch, setBatch] = useState('');
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!batch || !date) {
      setRoster([]);
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    attendanceApi
      .roster(batch, date)
      .then(setRoster)
      .catch(() => setError('Failed to load roster'))
      .finally(() => setLoading(false));
  }, [batch, date]);

  const setStatus = (enrollmentId, status) => {
    setRoster((prev) => prev.map((r) => (r.enrollment === enrollmentId ? { ...r, status } : r)));
  };

  const markAllPresent = () => {
    setRoster((prev) => prev.map((r) => ({ ...r, status: 'present' })));
  };

  const handleSave = async () => {
    const records = roster.filter((r) => r.status).map((r) => ({ enrollment: r.enrollment, status: r.status, remarks: r.remarks }));
    if (records.length === 0) {
      setError('Mark at least one student before saving');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await attendanceApi.mark(batch, date, records);
      setMessage('Attendance saved');
      onMarked?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Mark Attendance</h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-auto" value={batch} onChange={(e) => setBatch(e.target.value)}>
          <option value="">Select batch</option>
          {batches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.batchCode} — {b.course?.name}
            </option>
          ))}
        </Select>
        <Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        {canMark && (
          <>
            <Button variant="secondary" onClick={markAllPresent} disabled={roster.length === 0}>
              <CheckCheck size={15} /> Mark All Present
            </Button>
            <Button onClick={handleSave} disabled={saving || !batch || roster.length === 0}>
              <Save size={15} /> {saving ? 'Saving…' : 'Save Attendance'}
            </Button>
          </>
        )}
      </div>

      {message && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!batch ? (
        <p className="py-8 text-center text-sm text-slate-400">Select a batch and date to load the roster</p>
      ) : loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading roster...</p>
      ) : roster.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No enrolled students found in this batch</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {roster.map((r) => (
            <div key={r.enrollment} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{r.studentName}</p>
                {r.rollNumber && <p className="text-xs text-slate-400">Roll {r.rollNumber}</p>}
              </div>
              <div className="flex gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!canMark}
                    onClick={() => setStatus(r.enrollment, s)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize disabled:cursor-not-allowed disabled:opacity-50 ${
                      r.status === s
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { STATUSES };
