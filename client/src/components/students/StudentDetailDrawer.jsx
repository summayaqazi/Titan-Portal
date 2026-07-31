import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Drawer, StatusBadge, Select, Input, Button } from '../common';
import { enrollmentsApi } from '../../api/studentsApi';
import { ENROLLMENT_STATUSES } from '../../constants/enrollment';

export default function StudentDetailDrawer({ open, onClose, student, batches, onChanged }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [batchId, setBatchId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const load = () => {
    if (!student) return;
    setLoading(true);
    setError('');
    enrollmentsApi
      .listForStudent(student._id)
      .then(setEnrollments)
      .catch(() => setError('Failed to load enrollments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && student) {
      load();
      setBatchId('');
      setRollNumber('');
      setAddError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student]);

  const handleAddEnrollment = async (e) => {
    e.preventDefault();
    setAddError('');

    const batch = batches.find((b) => b._id === batchId);
    if (!batch) {
      setAddError('Please select a batch');
      return;
    }

    setAdding(true);
    try {
      await enrollmentsApi.create(student._id, {
        course: batch.course?._id,
        batch: batch._id,
        rollNumber,
        status: 'pending',
      });
      setBatchId('');
      setRollNumber('');
      load();
      onChanged?.();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add enrollment');
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (enrollmentId, status) => {
    await enrollmentsApi.update(enrollmentId, { status });
    load();
    onChanged?.();
  };

  const handleDelete = async (enrollmentId) => {
    await enrollmentsApi.remove(enrollmentId);
    load();
    onChanged?.();
  };

  if (!student) return null;

  return (
    <Drawer open={open} onClose={onClose} title={student.user?.name || 'Student'} width="w-[520px]">
      <div className="mb-6 space-y-1 text-sm">
        <p className="text-slate-500">{student.user?.email}</p>
        {student.user?.phone && <p className="text-slate-500">{student.user.phone}</p>}
        <p className="text-slate-500">{student.city?.name || 'No city set'}</p>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-slate-800">Enrollments</h3>

      <form onSubmit={handleAddEnrollment} className="mb-4 space-y-2 rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.batchCode} — {b.course?.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Roll number (optional)" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
        </div>
        {addError && <p className="text-xs text-red-600">{addError}</p>}
        <Button type="submit" variant="secondary" className="w-full" disabled={adding}>
          <Plus size={14} /> {adding ? 'Adding…' : 'Add Enrollment'}
        </Button>
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading enrollments...</p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-red-500">{error}</p>
      ) : enrollments.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No enrollments yet</p>
      ) : (
        <div className="space-y-3">
          {enrollments.map((en) => (
            <div key={en._id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{en.course?.name}</p>
                  <p className="text-xs text-slate-500">
                    {en.batch?.batchCode} · {en.campus?.name}
                    {en.rollNumber ? ` · Roll ${en.rollNumber}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(en._id)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove enrollment"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={en.status} />
                <Select
                  className="w-auto text-xs"
                  value={en.status}
                  onChange={(e) => handleStatusChange(en._id, e.target.value)}
                >
                  {ENROLLMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              {en.history?.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-400">History ({en.history.length})</summary>
                  <ul className="mt-1 space-y-1 text-xs text-slate-500">
                    {en.history.map((h, i) => (
                      <li key={i}>
                        {new Date(h.changedAt).toLocaleDateString()} — {h.status}
                        {h.note ? ` (${h.note})` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
