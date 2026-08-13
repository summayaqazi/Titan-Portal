import { useEffect, useState } from 'react';
import { CheckCircle2, EyeOff, Plus, Search, XCircle } from 'lucide-react';
import {
  PageContainer,
  Table,
  Pagination,
  Input,
  Select,
  Textarea,
  Button,
  StatusBadge,
  ConfirmDialog,
  Drawer,
  FormField,
  RowActions,
} from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { getErrorMessage } from '../../utils/errors';
import jobsApi from '../../api/jobsApi';
import { useAuth } from '../../context/AuthContext';

const JOB_TYPE_LABELS = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract' };

const emptyForm = {
  title: '',
  jobType: 'full_time',
  experience: '',
  qualification: '',
  about: '',
  subjectCommand: '',
  skills: '',
  expectedSalary: '',
  languages: '',
  links: '',
  description: '',
  requirements: '',
  openingDate: '',
  closingDate: '',
  status: 'draft',
  resumeRequired: true,
};

const toArray = (value) =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

function JobFormDrawer({ open, onClose, job, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(job);

  useEffect(() => {
    if (!open) return;
    setForm(
      job
        ? {
            title: job.title || '',
            jobType: job.jobType || 'full_time',
            experience: job.experience || '',
            qualification: job.qualification || '',
            about: job.about || '',
            subjectCommand: job.subjectCommand || '',
            skills: (job.skills || []).join(', '),
            expectedSalary: job.expectedSalary || '',
            languages: (job.languages || []).join(', '),
            links: (job.links || []).join(', '),
            description: job.description || '',
            requirements: (job.requirements || []).join(', '),
            openingDate: toDateInput(job.openingDate),
            closingDate: toDateInput(job.closingDate),
            status: job.status || 'draft',
            resumeRequired: job.resumeRequired !== false,
          }
        : emptyForm
    );
    setError('');
  }, [open, job]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.title.trim()) {
        setError('Job title is required');
        return;
      }
      if (form.openingDate && form.closingDate && form.closingDate <= form.openingDate) {
        setError('Closing date must be after opening date');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({
          ...form,
          skills: toArray(form.skills),
          languages: toArray(form.languages),
          links: toArray(form.links),
          requirements: toArray(form.requirements),
          openingDate: form.openingDate || undefined,
          closingDate: form.closingDate || undefined,
        });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save job'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Job' : 'Add Job'}
      width="w-[520px]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="job-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="job-form" onSubmit={handleSubmit}>
        <FormField label="Job Title" htmlFor="title" required>
          <Input id="title" value={form.title} onChange={handleChange('title')} required />
        </FormField>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <FormField label="Job Type" htmlFor="jobType" required>
            <Select id="jobType" value={form.jobType} onChange={handleChange('jobType')}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
            </Select>
          </FormField>
          <FormField label="Status" htmlFor="status">
            <Select id="status" value={form.status} onChange={handleChange('status')}>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <FormField label="Experience" htmlFor="experience">
            <Input id="experience" value={form.experience} onChange={handleChange('experience')} placeholder="e.g. 2-3 years" />
          </FormField>
          <FormField label="Qualification" htmlFor="qualification">
            <Input id="qualification" value={form.qualification} onChange={handleChange('qualification')} />
          </FormField>
        </div>
        <FormField label="Expected Salary" htmlFor="expectedSalary">
          <Input id="expectedSalary" value={form.expectedSalary} onChange={handleChange('expectedSalary')} placeholder="e.g. PKR 80,000 - 120,000" />
        </FormField>
        <FormField label="About" htmlFor="about">
          <Textarea id="about" rows={2} value={form.about} onChange={handleChange('about')} />
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Textarea id="description" rows={4} value={form.description} onChange={handleChange('description')} />
        </FormField>
        <FormField label="Requirements" htmlFor="requirements">
          <Textarea id="requirements" rows={3} value={form.requirements} onChange={handleChange('requirements')} placeholder="Comma-separated" />
        </FormField>
        <FormField label="Subject Command" htmlFor="subjectCommand">
          <Input id="subjectCommand" value={form.subjectCommand} onChange={handleChange('subjectCommand')} />
        </FormField>
        <FormField label="Skills" htmlFor="skills">
          <Input id="skills" value={form.skills} onChange={handleChange('skills')} placeholder="Comma-separated, e.g. React, Node.js" />
        </FormField>
        <FormField label="Languages" htmlFor="languages">
          <Input id="languages" value={form.languages} onChange={handleChange('languages')} placeholder="Comma-separated, e.g. English, Urdu" />
        </FormField>
        <FormField label="Important Links" htmlFor="links">
          <Input id="links" value={form.links} onChange={handleChange('links')} placeholder="Comma-separated URLs" />
        </FormField>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <FormField label="Opening Date" htmlFor="openingDate">
            <Input id="openingDate" type="date" value={form.openingDate} onChange={handleChange('openingDate')} />
          </FormField>
          <FormField label="Closing Date" htmlFor="closingDate">
            <Input id="closingDate" type="date" value={form.closingDate} onChange={handleChange('closingDate')} />
          </FormField>
        </div>
        <FormField label="Resume Required" htmlFor="resumeRequired">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input id="resumeRequired" type="checkbox" checked={form.resumeRequired} onChange={handleChange('resumeRequired')} />
            A resume/CV is required to apply
          </label>
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Jobs() {
  const { user, can } = useAuth();
  const canCreate = can('jobs', 'create');
  const canUpdate = can('jobs', 'update');
  const canDelete = can('jobs', 'delete');
  const { items, total, totalPages, page, setPage, search, changeSearch, filters, setFilter, loading, error, refetch, handleDeleted } =
    useCrudResource(jobsApi.list, { limit: 10 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Publish/Unpublish/Close/Reopen all funnel through the same confirm ->
  // PUT {status} action — { job, status, label } identifies which one is
  // pending confirmation.
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  const handleSubmit = async (values) => {
    if (editing) {
      await jobsApi.update(editing._id, values);
    } else {
      await jobsApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await jobsApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete job'));
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusConfirm = async () => {
    setStatusSubmitting(true);
    setStatusError('');
    try {
      await jobsApi.update(statusTarget.job._id, { status: statusTarget.status });
      setStatusTarget(null);
      refetch();
    } catch (err) {
      setStatusError(getErrorMessage(err, 'Failed to update job status'));
    } finally {
      setStatusSubmitting(false);
    }
  };

  // A row's own management buttons (Edit/Delete/status actions) are only
  // ever shown when this specific job allows it — canManage comes straight
  // from the server (Super Admin always true; Admin only for jobs they
  // created — see job.controller.js's canManageJob). This is a display
  // convenience only; the real enforcement is server-side regardless of
  // what renders here.
  const columns = [
    {
      key: 'title',
      header: 'Job',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-400">
            {JOB_TYPE_LABELS[row.jobType] || row.jobType}
            {row.createdBy?.name ? ` · by ${row.createdBy.name}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'dates',
      header: 'Opening / Closing',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.openingDate ? new Date(row.openingDate).toLocaleDateString() : '—'}
          {' → '}
          {row.closingDate ? new Date(row.closingDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.canManage && row.status === 'draft' && canUpdate && (
            <Button variant="ghost" onClick={() => setStatusTarget({ job: row, status: 'open', label: 'Publish' })}>
              <CheckCircle2 size={14} /> Publish
            </Button>
          )}
          {row.canManage && row.status === 'open' && canUpdate && (
            <>
              <Button variant="ghost" onClick={() => setStatusTarget({ job: row, status: 'draft', label: 'Unpublish' })}>
                <EyeOff size={14} /> Unpublish
              </Button>
              <Button variant="ghost" onClick={() => setStatusTarget({ job: row, status: 'closed', label: 'Close' })}>
                <XCircle size={14} /> Close
              </Button>
            </>
          )}
          {row.canManage && row.status === 'closed' && canUpdate && (
            <Button variant="ghost" onClick={() => setStatusTarget({ job: row, status: 'open', label: 'Reopen' })}>
              <CheckCircle2 size={14} /> Reopen
            </Button>
          )}
          <RowActions
            onEdit={
              row.canManage && canUpdate
                ? () => {
                    setEditing(row);
                    setFormOpen(true);
                  }
                : undefined
            }
            onDelete={row.canManage && canDelete ? () => setDeleteTarget(row) : undefined}
          />
        </div>
      ),
    },
  ];

  return (
    <PageContainer
      title="Jobs"
      description={user?.role === 'ADMIN' ? 'Manage the job postings you created' : 'Manage job postings for the institute'}
      actions={
        canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> Add Job
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by title" value={search} onChange={(e) => changeSearch(e.target.value)} />
        </div>
        <Select
          className="w-full max-w-[10rem]"
          value={filters.status || ''}
          onChange={(e) => setFilter('status', e.target.value || undefined)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No jobs found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <JobFormDrawer open={formOpen} onClose={() => setFormOpen(false)} job={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Job"
        message={deleteError || `Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => {
          setStatusTarget(null);
          setStatusError('');
        }}
        onConfirm={handleStatusConfirm}
        title={`${statusTarget?.label || ''} Job`}
        message={
          statusError ||
          `Are you sure you want to ${statusTarget?.label?.toLowerCase()} "${statusTarget?.job?.title}"?${
            statusTarget?.status === 'open' ? ' It will become visible on the public Jobs page.' : ''
          }${statusTarget?.status === 'draft' ? ' It will be hidden from the public Jobs page.' : ''}`
        }
        confirmLabel={statusTarget?.label}
        loading={statusSubmitting}
        danger={statusTarget?.status === 'closed'}
      />
    </PageContainer>
  );
}
