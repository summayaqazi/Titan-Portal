import { useEffect, useState } from 'react';
import { Table, Pagination, Select, Input, StatusBadge, ConfirmDialog, RowActions } from '../common';
import useCrudResource from '../../hooks/useCrudResource';
import attendanceApi from '../../api/attendanceApi';

const STATUSES = ['present', 'absent', 'leave', 'late'];

// Filterable attendance record list + delete, shared by the Super Admin
// combined Attendance page and the Admin "View Attendance" page.
// `refreshKey` lets a parent (e.g. after marking attendance) trigger a
// refetch that preserves the current filters/page, instead of remounting.
// `campusFilter` (Admin Portal's Campus Selector) scopes the list —
// undefined for Super Admin, so its query is unaffected.
export default function AttendanceHistoryPanel({ batches, canDelete, refreshKey, campusFilter }) {
  const listAttendance = (params) => attendanceApi.list({ ...params, campus: campusFilter });
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error, refetch, handleDeleted } =
    useCrudResource(listAttendance, { limit: 10 });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (refreshKey) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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
      render: (row) => <RowActions onDelete={canDelete ? () => setDeleteTarget(row) : undefined} />,
    },
  ];

  return (
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this attendance record?"
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
