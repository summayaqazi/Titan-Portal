import { Link } from 'react-router-dom';
import { Briefcase, Eye } from 'lucide-react';
import { PageContainer, Table, Pagination, Select, StatusBadge, Button, EmptyState } from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import applicantPortalApi from '../../api/applicantPortalApi';

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

// My Applications — GET /api/applicant/me/applications, paginated and
// status-filterable server-side (same useCrudResource hook every other
// paginated list page in this app already uses — see e.g. the public Jobs
// page). No text search: an applicant's own application count is small
// enough that a search box would be overbuilding it (same call already
// made server-side in applicantPortal.controller.js).
export default function Applications() {
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error } = useCrudResource(
    applicantPortalApi.listApplications,
    { limit: 10 }
  );

  const columns = [
    {
      key: 'job',
      header: 'Job Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.job?.title || 'Job no longer available'}</p>
          {row.job && <p className="text-xs text-slate-400">{JOB_TYPE_LABELS[row.job.jobType] || row.job.jobType}</p>}
        </div>
      ),
    },
    { key: 'appliedDate', header: 'Applied Date', render: (row) => formatDate(row.appliedDate) },
    { key: 'closingDate', header: 'Closing Date', render: (row) => (row.job ? formatDate(row.job.closingDate) : '—') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Link
          to={`/applicant/applications/${row._id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        >
          <Eye size={13} /> View
        </Link>
      ),
    },
  ];

  return (
    <PageContainer title="My Applications" description="Every job you've applied for, and its current status">
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
      ) : !loading && total === 0 && !filters.status ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <EmptyState
            icon={Briefcase}
            title="You have not applied for any jobs yet"
            description="Browse open positions and submit your first application."
          />
          <div className="flex justify-center pb-6">
            <Link to="/jobs">
              <Button variant="secondary">Browse Jobs</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table
            columns={columns}
            data={loading ? [] : items}
            emptyMessage={loading ? 'Loading...' : 'No applications match this filter'}
          />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}
    </PageContainer>
  );
}
