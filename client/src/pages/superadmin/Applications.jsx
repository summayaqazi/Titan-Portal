import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { PageContainer, Table, Pagination, Select, StatusBadge, Avatar } from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import applicationsApi from '../../api/applicationsApi';
import ApplicationDetailDrawer from '../../components/applications/ApplicationDetailDrawer';
import { resolveFileUrl } from '../../utils/fileUrl';

const JOB_TYPE_LABELS = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract' };
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Super Admin Application Management — every application in the system,
// paginated + status-filterable server-side (same useCrudResource hook
// every other admin list page already uses). Row click opens the detail
// drawer, which owns the actual Shortlist/Approve/Reject actions.
export default function Applications() {
  // Lets the Super Admin Dashboard's "Pending Job Applications" card land
  // here pre-filtered (?status=pending) — read once on mount only, same as
  // every other page's own filter state afterward (changing the dropdown
  // doesn't rewrite the URL, matching this app's existing filter UX).
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error, refetch } = useCrudResource(
    applicationsApi.list,
    { limit: 10, initialFilters: initialStatus ? { status: initialStatus } : {} }
  );
  const [selected, setSelected] = useState(null);
  // Super-Admin-only route (Admin has no access to this page at all — see
  // application.routes.js), so this is unconditional, unlike the shared
  // Jobs.jsx/Students.jsx pages' role-gated onBack.
  const navigate = useNavigate();

  const handleChanged = (updated) => {
    setSelected(updated);
    refetch();
  };

  const columns = [
    {
      key: 'applicant',
      header: 'Applicant',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {/* The applicant's own submitted photo (Application.photoPath) —
              same field the detail drawer shows, distinct from the job's
              own image. */}
          <Avatar src={resolveFileUrl(row.photoPath)} name={row.applicant?.name} size={32} />
          <div>
            <p className="font-medium text-slate-800">{row.applicant?.name || '—'}</p>
            <p className="text-xs text-slate-400">{row.applicant?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      render: (row) => (
        <div>
          <p className="text-slate-700">{row.job?.title || 'Job no longer available'}</p>
          {row.job && (
            <p className="text-xs text-slate-400">
              {JOB_TYPE_LABELS[row.job.jobType] || row.job.jobType}
              {row.job.city ? ` · ${row.job.city}` : ''}
            </p>
          )}
        </div>
      ),
    },
    { key: 'appliedDate', header: 'Applied', render: (row) => formatDate(row.appliedDate) },
    { key: 'experience', header: 'Experience', render: (row) => row.experience || '—' },
    { key: 'qualification', header: 'Qualification', render: (row) => row.qualification || '—' },
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
      title="Applications"
      description="Review job applications and manage their status"
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
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No applications found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <ApplicationDetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} application={selected} onChanged={handleChanged} />
    </PageContainer>
  );
}
