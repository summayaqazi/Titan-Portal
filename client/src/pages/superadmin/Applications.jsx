import { useState } from 'react';
import { Eye } from 'lucide-react';
import { PageContainer, Table, Pagination, Select, StatusBadge } from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import applicationsApi from '../../api/applicationsApi';
import ApplicationDetailDrawer from '../../components/applications/ApplicationDetailDrawer';

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
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error, refetch } = useCrudResource(
    applicationsApi.list,
    { limit: 10 }
  );
  const [selected, setSelected] = useState(null);

  const handleChanged = (updated) => {
    setSelected(updated);
    refetch();
  };

  const columns = [
    {
      key: 'applicant',
      header: 'Applicant',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.applicant?.name || '—'}</p>
          <p className="text-xs text-slate-400">{row.applicant?.email}</p>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      render: (row) => (
        <div>
          <p className="text-slate-700">{row.job?.title || 'Job no longer available'}</p>
          {row.job && <p className="text-xs text-slate-400">{JOB_TYPE_LABELS[row.job.jobType] || row.job.jobType}</p>}
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
    <PageContainer title="Applications" description="Review job applications and manage their status">
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
