import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  ImageUpload,
  RowActions,
} from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import jobsApi from '../../api/jobsApi';
import campusesApi from '../../api/campusesApi';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

const JOB_TYPE_LABELS = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract' };

const emptyForm = {
  title: '',
  jobType: 'full_time',
  city: '',
  campus: '',
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

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

// `readOnly` is the Campus Admin path: same drawer, same fields (so it
// never drifts out of sync with what Super Admin can enter), but every
// input disabled and no Save — just a Close button. Reusing this one
// component instead of a second "view job" component keeps the two
// presentations of the same data honest with each other.
function JobFormDrawer({ open, onClose, job, onSubmit, campuses, readOnly = false }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(job);

  // Image — always optional, kept as-is on edit unless a new file is
  // picked (see job.controller.js's removeImage). `imageFile` is the
  // newly-picked File (or null); `imageRemoved` tracks an explicit removal
  // of an existing image via ImageUpload's own X button, same
  // pick/remove/keep-existing shape Profile.jsx's avatar already uses.
  const [imageFile, setImageFile] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(
      job
        ? {
            title: job.title || '',
            jobType: job.jobType || 'full_time',
            city: job.city || '',
            campus: job.campus?._id || job.campus || '',
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
    setImageFile(null);
    setImageRemoved(false);
    setImageError('');
    setError('');
  }, [open, job]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;
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
        // skills/languages/links/requirements go through as the raw
        // comma-separated strings already in `form` — this now submits as
        // multipart/form-data (for the image), and job.controller.js's own
        // toArray() splits them server-side, same convention
        // applicantPortal.controller.js's Application form already uses for
        // its own comma-separated fields. Sent even when empty (never
        // omitted) so clearing a field to none actually clears it, not just
        // leaves it untouched.
        await onSubmit({
          ...form,
          openingDate: form.openingDate || undefined,
          closingDate: form.closingDate || undefined,
          image: imageFile,
          removeImage: imageRemoved && !imageFile,
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
      title={readOnly ? 'Job Details' : isEdit ? 'Edit Job' : 'Add Job'}
      width="w-[520px]"
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="job-form" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </>
        )
      }
    >
      <form id="job-form" onSubmit={handleSubmit}>
        <FormField label="Job Title" htmlFor="title" required={!readOnly}>
          <Input id="title" value={form.title} onChange={handleChange('title')} required={!readOnly} disabled={readOnly} />
        </FormField>
        {/* Always optional — a job can be published (status='open') with or
            without one. Only ever shown here (the create/edit form's own
            preview) and on the public Job Details page — never in a jobs
            listing (this table, or the public careers grid), which shows
            no image at all. Kept as-is on edit unless a new file is picked
            or explicitly removed (ImageUpload's own X button). Read-only
            mode skips the interactive picker entirely (it has no disabled
            state of its own) and just shows the image. */}
        {readOnly ? (
          <FormField label="Job Image">
            {job?.image ? (
              <img
                src={resolveFileUrl(job.image)}
                alt=""
                loading="lazy"
                decoding="async"
                width={96}
                height={96}
                className="h-24 w-24 rounded-md border border-slate-200 object-cover"
              />
            ) : (
              <p className="text-sm text-slate-400">No image</p>
            )}
          </FormField>
        ) : (
          <FormField label="Job Image" htmlFor="image">
            <ImageUpload
              currentUrl={resolveFileUrl(job?.image)}
              onChange={(file) => {
                setImageFile(file);
                setImageError('');
                if (file) setImageRemoved(false);
              }}
              onRemove={() => setImageRemoved(true)}
              error={imageError}
              setError={setImageError}
            />
            <p className="mt-1 text-xs text-slate-400">JPG, PNG or WEBP, up to 2MB. Optional.</p>
          </FormField>
        )}
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <FormField label="Job Type" htmlFor="jobType" required={!readOnly}>
            <Select id="jobType" value={form.jobType} onChange={handleChange('jobType')} disabled={readOnly}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
            </Select>
          </FormField>
          <FormField label="Status" htmlFor="status">
            <Select id="status" value={form.status} onChange={handleChange('status')} disabled={readOnly}>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </Select>
          </FormField>
        </div>
        {/* City/Location — the city the position is actually based in.
            Free text (matches expectedSalary/qualification's own pattern
            on this form) rather than a Campus/City-model reference: a job
            posting isn't tied to a campus and can be in a city with no
            campus at all. Optional — older jobs have no value here and
            still work everywhere it's displayed. */}
        <FormField label="City / Location" htmlFor="city">
          <Input id="city" value={form.city} onChange={handleChange('city')} placeholder="e.g. Sukkur" disabled={readOnly} />
        </FormField>
        {/* Campus — distinct from City/Location above: the specific TITAN
            campus this opening belongs to, if any. Together with City/
            Location, this scopes the job into a Campus Admin's read-only
            view (see job.controller.js's getAdminJobScope) — left unset
            with a City/Location that doesn't match any Campus Admin's
            assigned campus, the job is only ever visible to Super Admin. */}
        <FormField label="Campus" htmlFor="campus">
          <Select id="campus" value={form.campus} onChange={handleChange('campus')} disabled={readOnly}>
            <option value="">No campus (Super Admin only)</option>
            {campuses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <FormField label="Experience" htmlFor="experience">
            <Input id="experience" value={form.experience} onChange={handleChange('experience')} placeholder="e.g. 2-3 years" disabled={readOnly} />
          </FormField>
          <FormField label="Qualification" htmlFor="qualification">
            <Input id="qualification" value={form.qualification} onChange={handleChange('qualification')} disabled={readOnly} />
          </FormField>
        </div>
        <FormField label="Expected Salary" htmlFor="expectedSalary">
          <Input id="expectedSalary" value={form.expectedSalary} onChange={handleChange('expectedSalary')} placeholder="e.g. PKR 80,000 - 120,000" disabled={readOnly} />
        </FormField>
        <FormField label="About" htmlFor="about">
          <Textarea id="about" rows={2} value={form.about} onChange={handleChange('about')} disabled={readOnly} />
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Textarea id="description" rows={4} value={form.description} onChange={handleChange('description')} disabled={readOnly} />
        </FormField>
        <FormField label="Requirements" htmlFor="requirements">
          <Textarea id="requirements" rows={3} value={form.requirements} onChange={handleChange('requirements')} placeholder="Comma-separated" disabled={readOnly} />
        </FormField>
        <FormField label="Subject Command" htmlFor="subjectCommand">
          <Input id="subjectCommand" value={form.subjectCommand} onChange={handleChange('subjectCommand')} disabled={readOnly} />
        </FormField>
        <FormField label="Skills" htmlFor="skills">
          <Input id="skills" value={form.skills} onChange={handleChange('skills')} placeholder="Comma-separated, e.g. React, Node.js" disabled={readOnly} />
        </FormField>
        <FormField label="Languages" htmlFor="languages">
          <Input id="languages" value={form.languages} onChange={handleChange('languages')} placeholder="Comma-separated, e.g. English, Urdu" disabled={readOnly} />
        </FormField>
        <FormField label="Important Links" htmlFor="links">
          <Input id="links" value={form.links} onChange={handleChange('links')} placeholder="Comma-separated URLs" disabled={readOnly} />
        </FormField>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <FormField label="Opening Date" htmlFor="openingDate">
            <Input id="openingDate" type="date" value={form.openingDate} onChange={handleChange('openingDate')} disabled={readOnly} />
          </FormField>
          <FormField label="Closing Date" htmlFor="closingDate">
            <Input id="closingDate" type="date" value={form.closingDate} onChange={handleChange('closingDate')} disabled={readOnly} />
          </FormField>
        </div>
        <FormField label="Resume Required" htmlFor="resumeRequired">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input id="resumeRequired" type="checkbox" checked={form.resumeRequired} onChange={handleChange('resumeRequired')} disabled={readOnly} />
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
  const isAdmin = user?.role === ROLES.ADMIN;
  const canCreate = can('jobs', 'create');
  const canUpdate = can('jobs', 'update');
  const canDelete = can('jobs', 'delete');
  const navigate = useNavigate();

  // Scopes the list (and, server-side, every mutation attempt) to whichever
  // campus is currently selected on the Admin Portal's Campus Selector —
  // undefined for every role but ADMIN, so this request is byte-for-byte
  // unchanged for Super Admin. Same convention Students.jsx/Trainers.jsx/
  // the Attendance pages already use; Job Portal previously ignored this
  // entirely (fixed to the Admin's own User.campus instead), which is what
  // let switching the Selector leave the Jobs list unchanged — see
  // job.controller.js's getAdminJobScope, the actual (server-side)
  // enforcement point.
  const campusFilter = useAdminCampusFilter();
  const listJobs = (params) => jobsApi.list({ ...params, campus: campusFilter });

  // Lets the Super Admin Dashboard's "Open Job Vacancies" card land here
  // pre-filtered (?status=open) — read once on mount, same as
  // Applications.jsx's own initial-filter-from-URL read.
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const { items, total, totalPages, page, setPage, search, changeSearch, filters, setFilter, loading, error, refetch, handleDeleted } =
    useCrudResource(listJobs, { limit: 10, initialFilters: initialStatus ? { status: initialStatus } : {} });

  // For the Campus field on the create/edit form (Super Admin only reaches
  // it in practice — Admin's Add/Edit buttons are already hidden below via
  // canCreate/canUpdate) and the Campus column every role sees. Same
  // campuses API/list every other admin form already calls.
  const [campuses, setCampuses] = useState([]);
  useEffect(() => {
    campusesApi.list({ limit: 100 }).then((res) => setCampuses(res.data));
  }, []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  // True when the drawer was opened via the read-only "View" action
  // (Campus Admin's own row action, since Edit is hidden for them) rather
  // than Edit/Add Job — see JobFormDrawer's `readOnly` prop.
  const [viewOnly, setViewOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Publish/Unpublish/Close/Reopen all funnel through the same confirm ->
  // PUT {status} action — { job, status, label } identifies which one is
  // pending confirmation.
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  // Multipart now (image upload) instead of plain JSON — axios sets the
  // right Content-Type/boundary automatically for a FormData body, same as
  // every other file-carrying form in this app (Profile's avatar, the
  // Applicant application form). `image`/`removeImage` are handled
  // separately; every other field is sent as-is (job.controller.js reads
  // skills/languages/links/requirements as comma-separated strings and
  // splits them server-side, exactly like the Application form already
  // does for its own array fields).
  const buildJobFormData = (values) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'image' || key === 'removeImage') return;
      if (value === undefined || value === null) return;
      formData.append(key, value);
    });
    if (values.image instanceof File) formData.append('image', values.image);
    if (values.removeImage) formData.append('removeImage', 'true');
    return formData;
  };

  const handleSubmit = async (values) => {
    const formData = buildJobFormData(values);
    if (editing) {
      await jobsApi.update(editing._id, formData);
    } else {
      await jobsApi.create(formData);
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

  // A row's own management buttons (Edit/Delete/status actions) require
  // both canManage (server-computed — Super Admin always true; effectively
  // never true for Admin now that create/update/delete permissions are
  // withheld entirely, see job.controller.js) and the matching
  // canUpdate/canDelete permission below, so Admin never sees them
  // regardless of canManage. Display convenience only; the real
  // enforcement is server-side regardless of what renders here.
  const columns = [
    {
      key: 'title',
      header: 'Job',
      // No thumbnail here — the Jobs listing never shows a job image (no
      // image, no "No image" placeholder, no broken-image box); the image
      // (when a job has one) is only ever shown on the create/edit
      // drawer's own preview and the public Job Details page.
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
    { key: 'city', header: 'Location', render: (row) => (row.city ? row.city : <span className="text-slate-400">—</span>) },
    { key: 'campus', header: 'Campus', render: (row) => (row.campus?.name ? row.campus.name : <span className="text-slate-400">—</span>) },
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
            // Read-only "View" for whoever can't Edit (Campus Admin, always
            // — canUpdate is false for that role now) — same job details,
            // via the same JobFormDrawer in readOnly mode, so the section
            // never just disappears for them. Super Admin/an Admin who can
            // edit keeps the exact same single Edit action as before (no
            // redundant View button cluttering their row).
            onView={
              !canUpdate
                ? () => {
                    setEditing(row);
                    setViewOnly(true);
                    setFormOpen(true);
                  }
                : undefined
            }
            onEdit={
              row.canManage && canUpdate
                ? () => {
                    setEditing(row);
                    setViewOnly(false);
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
      description={isAdmin ? 'View job postings for the selected campus/city (read-only)' : 'Manage job postings for the institute'}
      // Now on for both roles that reach this page: Admin already had it,
      // and Super Admin's own dashboard cards ("Open Job Vacancies") and
      // sidebar both land here too — no role gate needed on this one.
      onBack={() => navigate(-1)}
      actions={
        canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setViewOnly(false);
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

      <JobFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        job={editing}
        onSubmit={handleSubmit}
        campuses={campuses}
        readOnly={viewOnly}
      />

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
