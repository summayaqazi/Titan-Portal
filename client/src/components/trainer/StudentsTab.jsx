import { useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { Table, Pagination, Input, StatusBadge, Modal, Avatar } from '../common';
import useCrudResource from '../../hooks/useCrudResource';
import trainerPortalApi from '../../api/trainerPortalApi';
import { resolveFileUrl } from '../../utils/fileUrl';

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
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          <Eye size={14} /> View
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-xs">
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No students found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <Modal open={Boolean(detailStudent)} onClose={() => setDetailStudent(null)} title="Student Details" size="sm">
        {detailStudent && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Avatar src={resolveFileUrl(detailStudent.avatar)} name={detailStudent.name} size={48} />
              <div>
                <p className="text-base font-semibold text-slate-800">{detailStudent.name}</p>
                <p className="text-sm text-slate-500">{detailStudent.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Phone</dt>
                <dd className="text-slate-700">{detailStudent.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Roll Number</dt>
                <dd className="text-slate-700">{detailStudent.rollNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Enrollment Status</dt>
                <dd>
                  <StatusBadge status={detailStudent.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Admitted On</dt>
                <dd className="text-slate-700">
                  {detailStudent.admissionDate ? new Date(detailStudent.admissionDate).toLocaleDateString() : '—'}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}
