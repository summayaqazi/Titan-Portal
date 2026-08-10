import { useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { Table, Pagination, Input, StatusBadge, Avatar } from '../common';
import useCrudResource from '../../hooks/useCrudResource';
import trainerPortalApi from '../../api/trainerPortalApi';
import { resolveFileUrl } from '../../utils/fileUrl';
import StudentDetailDrawer from './StudentDetailDrawer';

// Trainer's read-only view of students enrolled in this one batch — always
// via Enrollment (never a direct Course-on-Student field). No create/edit/
// delete: trainers only view.
export default function StudentsTab({ batchId }) {
  const listStudents = (params) => trainerPortalApi.getCourseStudents(batchId, params);
  const { items, total, totalPages, page, setPage, search, changeSearch, loading, error } = useCrudResource(
    listStudents,
    { limit: 10 }
  );

  const [detailStudent, setDetailStudent] = useState(null);

  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={resolveFileUrl(row.avatar)} name={row.name} size={32} />
          <div>
            <p className="font-medium text-slate-800">{row.name}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'rollNumber', header: 'Roll Number', render: (row) => row.rollNumber || '—' },
    { key: 'status', header: 'Enrollment Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => setDetailStudent(row)}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        >
          <Eye size={14} /> View
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          {/* Desktop/tablet: the shared Table (horizontally scrolls its own
              container if ever needed, never the page). Hidden below sm —
              a 5-column table with an avatar+email cell doesn't fit a phone
              width without either clipping the name or forcing sideways
              scrolling to reach Status/View, so phones get the dedicated
              card list below instead of a shrunk table. */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white sm:block">
            <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No students found'} />
            <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </div>

          {/* Mobile: one card per student — photo, full name, email, roll
              number, status, and the View action are all visible at once,
              nothing clipped or reachable only via horizontal scroll. */}
          <div className="sm:hidden">
            <div className="space-y-2.5">
              {loading ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading...</p>
              ) : items.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No students found</p>
              ) : (
                items.map((row) => (
                  <button
                    key={row.enrollmentId}
                    type="button"
                    onClick={() => setDetailStudent(row)}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left active:bg-slate-50"
                  >
                    <Avatar src={resolveFileUrl(row.avatar)} name={row.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{row.name}</p>
                      <p className="truncate text-xs text-slate-400">{row.email}</p>
                      <p className="mt-1 text-xs text-slate-500">Roll {row.rollNumber || '—'}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={row.status} />
                      <Eye size={16} className="text-primary-600" />
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
            </div>
          </div>
        </>
      )}

      <StudentDetailDrawer
        open={Boolean(detailStudent)}
        onClose={() => setDetailStudent(null)}
        batchId={batchId}
        studentId={detailStudent?.studentId}
        studentName={detailStudent?.name}
      />
    </div>
  );
}
