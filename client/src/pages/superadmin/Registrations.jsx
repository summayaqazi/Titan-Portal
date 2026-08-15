import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { PageContainer, Table, Pagination, Select, StatusBadge, Avatar } from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';
import registrationsApi from '../../api/registrationsApi';
import RegistrationDetailDrawer from '../../components/registrations/RegistrationDetailDrawer';
import { resolveFileUrl } from '../../utils/fileUrl';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Super Admin (+ campus-scoped Admin) Registration review — a completely
// separate module from Students.jsx. A Registration is a public
// course-registration submission that hasn't (yet, or ever) become a
// Student; this page never reuses the Students table/component/API, and
// approving a row here is what creates the resulting Student, not the other
// way around. See server/src/models/Registration.js's header comment for
// the full reasoning behind keeping these two modules apart.
export default function Registrations() {
  // Undefined for every role but ADMIN, so this list request is
  // byte-for-byte unchanged for Super Admin — same convention Students.jsx/
  // Jobs.jsx already use for their own campus scoping.
  const campusFilter = useAdminCampusFilter();
  const listRegistrations = (params) => registrationsApi.list({ ...params, campus: campusFilter });

  // Lets the Super Admin Dashboard's "Student Registrations" card family
  // land here pre-filtered (?status=pending) — read once on mount only,
  // same as Applications.jsx's own initial-filter-from-URL read.
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error, refetch } = useCrudResource(
    listRegistrations,
    { limit: 10, initialFilters: initialStatus ? { status: initialStatus } : {} }
  );
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const handleChanged = (updated) => {
    setSelected(updated);
    refetch();
  };

  const columns = [
    {
      key: 'name',
      header: 'Registrant',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={resolveFileUrl(row.profilePicture)} name={row.name} size={32} />
          <div>
            <p className="font-medium text-slate-800">{row.name || '—'}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course / Batch',
      render: (row) => (
        <div>
          <p className="text-slate-700">{row.course?.name || 'Course no longer available'}</p>
          {row.batch && <p className="text-xs text-slate-400">{row.batch.batchCode}</p>}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Submitted', render: (row) => formatDate(row.createdAt) },
    { key: 'cnic', header: 'CNIC', render: (row) => row.cnic || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        >
          <Eye size={13} /> Review
        </button>
      ),
    },
  ];

  return (
    <PageContainer
      title="Student Registrations"
      description="Review public course-registration submissions and approve or reject them"
      onBack={() => navigate(-1)}
    >
      <div className="mb-4 w-full max-w-[10rem]">
        <Select value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value || undefined)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No registrations found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <RegistrationDetailDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        registration={selected}
        onChanged={handleChanged}
      />
    </PageContainer>
  );
}
