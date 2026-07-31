import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  PageContainer,
  Table,
  Pagination,
  Select,
  Input,
  Button,
  StatusBadge,
  ConfirmDialog,
  RowActions,
} from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import attendanceApi from '../../api/attendanceApi';
import batchesApi from '../../api/batchesApi';

const STATUSES = ['present', 'absent', 'leave', 'late'];
const today = () => new Date().toISOString().slice(0, 10);

function MarkAttendancePanel({ batches, onMarked }) {
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
        <Button onClick={handleSave} disabled={saving || !batch || roster.length === 0}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save Attendance'}
        </Button>
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
                    onClick={() => setStatus(r.enrollment, s)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize ${
                      r.status === s
                        ? 'border-blue-600 bg-blue-600 text-white'
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

export default function Attendance() {
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error, refetch, handleDeleted } =
    useCrudResource(attendanceApi.list, { limit: 10 });

  const [batches, setBatches] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    batchesApi.list({ limit: 100 }).then((res) => setBatches(res.data));
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await attendanceApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'student', header: 'Student', render: (row) => row.student?.user?.name || '—' },
    { key: 'batch', header: 'Batch', render: (row) => row.batch?.batchCode || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'markedBy', header: 'Marked By', render: (row) => row.markedBy?.name || '—' },
    {
      key: 'actions',
      header: '',
      render: (row) => <RowActions onDelete={() => setDeleteTarget(row)} />,
    },
  ];

  return (
    <PageContainer title="Attendance" description="Mark and review student attendance across batches">
      <MarkAttendancePanel batches={batches} onMarked={refetch} />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-800">Attendance History</h2>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select className="w-auto" value={filters.batch || ''} onChange={(e) => setFilter('batch', e.target.value)}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.batchCode}
              </option>
            ))}
          </Select>
          <Input type="date" className="w-auto" value={filters.date || ''} onChange={(e) => setFilter('date', e.target.value)} />
          <Select className="w-auto" value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No attendance records found'} />
            <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this attendance record?"
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
