import { useEffect, useState } from 'react';
import { Check, LogOut, X } from 'lucide-react';
import { Table, Pagination, Select, Input, StatusBadge, ConfirmDialog, RowActions, Avatar } from '../common';
import useCrudResource from '../../hooks/useCrudResource';
import trainerAttendanceApi from '../../api/trainerAttendanceApi';
import { resolveFileUrl } from '../../utils/fileUrl';
import { getErrorMessage } from '../../utils/errors';

// Trainer attendance record list, check-out, and verify/reject actions,
// shared by the Super Admin combined Attendance page and the Admin
// "View Trainer Attendance" / "Attendance Request" pages. `initialFilters`
// lets a page preset e.g. { status: 'pending' } for a requests-only view
// without duplicating this component. `campusFilter` (Admin Portal's
// Campus Selector) scopes the list — undefined for Super Admin, so its
// query is unaffected.
export default function TrainerAttendanceHistory({
  trainers,
  batches,
  canUpdate,
  canDelete,
  refreshKey,
  initialFilters,
  campusFilter,
  title = 'Trainer Attendance History & Requests',
}) {
  const listTrainerAttendance = (params) => trainerAttendanceApi.list({ ...params, campus: campusFilter });
  const {
    items,
    total,
    totalPages,
    page,
    setPage,
    filters,
    setFilter,
    loading,
    error,
    refetch,
    handleDeleted,
  } = useCrudResource(listTrainerAttendance, { limit: 10, initialFilters });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (refreshKey) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleCheckOut = async (row) => {
    setActionError('');
    setBusyId(row._id);
    try {
      await trainerAttendanceApi.checkOut(row._id);
      refetch();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to check out trainer'));
    } finally {
      setBusyId(null);
    }
  };

  const handleVerify = async (row, action) => {
    setActionError('');
    setBusyId(row._id);
    try {
      await trainerAttendanceApi.verify(row._id, action);
      refetch();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to update request'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await trainerAttendanceApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'trainer',
      header: 'Trainer',
      render: (row) =>
        row.trainer?.user?.name ? (
          <div className="flex items-center gap-2">
            <Avatar src={resolveFileUrl(row.trainer.profileImage)} name={row.trainer.user.name} size={24} />
            <span>{row.trainer.user.name}</span>
          </div>
        ) : (
          '—'
        ),
    },
    { key: 'batch', header: 'Batch', render: (row) => row.batch?.batchCode || '—' },
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      key: 'checkIn',
      header: 'Check-In',
      render: (row) => new Date(row.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'checkOut',
      header: 'Check-Out',
      render: (row) =>
        row.checkOutTime ? (
          new Date(row.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ) : canUpdate ? (
          <button
            type="button"
            onClick={() => handleCheckOut(row)}
            disabled={busyId === row._id}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-40"
          >
            <LogOut size={13} /> Check Out
          </button>
        ) : (
          '—'
        ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => (row.durationMinutes != null ? `${row.durationMinutes} min` : '—'),
    },
    {
      key: 'late',
      header: 'Late',
      render: (row) => (row.isLate ? <StatusBadge status="late" /> : <span className="text-slate-300">—</span>),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {canUpdate && row.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => handleVerify(row, 'verify')}
                disabled={busyId === row._id}
                className="rounded p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-40"
                aria-label="Verify"
                title="Verify request"
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleVerify(row, 'reject')}
                disabled={busyId === row._id}
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                aria-label="Reject"
                title="Reject request"
              >
                <X size={15} />
              </button>
            </>
          )}
          <RowActions onDelete={canDelete ? () => setDeleteTarget(row) : undefined} />
        </div>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-auto" value={filters.trainer || ''} onChange={(e) => setFilter('trainer', e.target.value)}>
          <option value="">All trainers</option>
          {trainers.map((t) => (
            <option key={t._id} value={t._id}>
              {t.user?.name}
            </option>
          ))}
        </Select>
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
          <option value="pending">Pending requests</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      {actionError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{actionError}</div>}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table
            columns={columns}
            data={loading ? [] : items}
            emptyMessage={loading ? 'Loading...' : 'No trainer attendance records found'}
          />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Trainer Attendance Record"
        message="Are you sure you want to delete this attendance record?"
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
