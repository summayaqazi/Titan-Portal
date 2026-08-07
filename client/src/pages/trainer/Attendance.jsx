import { PageContainer, Table, Pagination, Select, Input, StatusBadge } from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import trainerPortalApi from '../../api/trainerPortalApi';

const formatTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

// This trainer's own check-in/check-out history — not the student roster
// (that's the per-course Attendance tab inside Course Workspace). Read-only:
// checking in/out and verifying is still an Admin/Super Admin action (see
// trainerAttendance.routes.js), this just gives the trainer visibility into
// their own record via the exact same controller, force-scoped to them.
export default function Attendance() {
  const listHistory = (params) => trainerPortalApi.getAttendanceHistory(params);
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error } = useCrudResource(listHistory, {
    limit: 10,
  });

  const columns = [
    { key: 'batch', header: 'Batch', render: (row) => row.batch?.batchCode || '—' },
    { key: 'course', header: 'Course', render: (row) => row.batch?.course?.name || '—' },
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'checkIn', header: 'Check-In', render: (row) => formatTime(row.checkInTime) },
    { key: 'checkOut', header: 'Check-Out', render: (row) => formatTime(row.checkOutTime) },
    { key: 'duration', header: 'Duration', render: (row) => (row.durationMinutes != null ? `${row.durationMinutes} min` : '—') },
    { key: 'late', header: 'Late', render: (row) => (row.isLate ? <StatusBadge status="late" /> : <span className="text-slate-300">—</span>) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <PageContainer title="Attendance" description="Your own check-in / check-out history">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input type="date" className="w-auto" value={filters.date || ''} onChange={(e) => setFilter('date', e.target.value)} />
        <Select className="w-auto" value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table
            columns={columns}
            data={loading ? [] : items}
            emptyMessage={loading ? 'Loading...' : 'No attendance records yet'}
          />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}
    </PageContainer>
  );
}
