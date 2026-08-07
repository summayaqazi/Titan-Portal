import { useEffect, useState } from 'react';
import { Plus, Search, X, Eye } from 'lucide-react';
import {
  Table,
  Pagination,
  Input,
  Textarea,
  Button,
  Drawer,
  FormField,
  RowActions,
  MultiFileInput,
  ConfirmDialog,
} from '../common';
import useCrudResource from '../../hooks/useCrudResource';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import trainerAssignmentsApi from '../../api/trainerAssignmentsApi';
import { getErrorMessage } from '../../utils/errors';
import SubmissionsView from './SubmissionsView';

const emptyForm = { title: '', description: '', dueDate: '', referenceLinks: [], topic: '' };

// Small "type a value, press Enter or Add to add a chip" input — used by
// Reference Links (a genuine list of strings). Topic is a single field, not
// a tag list, so it doesn't use this.
function TagListInput({ values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...values, value]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {v}
              <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentFormDrawer({ open, onClose, assignment, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [referenceImageFiles, setReferenceImageFiles] = useState([]);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [removeReferenceImages, setRemoveReferenceImages] = useState([]);
  const [removeAttachments, setRemoveAttachments] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(assignment);

  useEffect(() => {
    if (!open) return;
    setForm(
      assignment
        ? {
            title: assignment.title,
            description: assignment.description || '',
            dueDate: assignment.dueDate ? assignment.dueDate.slice(0, 10) : '',
            referenceLinks: assignment.referenceLinks || [],
            topic: assignment.topic || '',
          }
        : emptyForm
    );
    setReferenceImageFiles([]);
    setAttachmentFiles([]);
    setRemoveReferenceImages([]);
    setRemoveAttachments([]);
    setError('');
  }, [open, assignment]);

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.title.trim()) {
        setError('Title is required');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({
          ...form,
          referenceImageFiles,
          attachmentFiles,
          removeReferenceImages,
          removeAttachments,
        });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save assignment'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Assignment' : 'Create Assignment'}
      width="w-[560px]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="assignment-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="assignment-form" onSubmit={handleSubmit}>
        <FormField label="Title" htmlFor="title" required>
          <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
        </FormField>

        <FormField label="Description">
          <Textarea
            rows={5}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="What students need to do…"
          />
        </FormField>

        <FormField label="Due Date" htmlFor="dueDate">
          <Input id="dueDate" type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
        </FormField>

        <FormField label="Topic" htmlFor="topic">
          <Input id="topic" value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} placeholder="e.g. React Hooks" />
        </FormField>

        <FormField label="Reference Links">
          <TagListInput
            values={form.referenceLinks}
            onChange={(v) => setForm((p) => ({ ...p, referenceLinks: v }))}
            placeholder="https://…"
          />
        </FormField>

        <FormField label="Reference Images">
          <MultiFileInput
            label="Add images"
            accept="image/*"
            files={referenceImageFiles}
            onFilesChange={setReferenceImageFiles}
            existingUrls={(assignment?.referenceImages || []).filter((u) => !removeReferenceImages.includes(u))}
            onRemoveExisting={(url) => setRemoveReferenceImages((p) => [...p, url])}
          />
        </FormField>

        <FormField label="Attachments">
          <MultiFileInput
            label="Add attachments"
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
            existingUrls={(assignment?.attachments || []).filter((u) => !removeAttachments.includes(u))}
            onRemoveExisting={(url) => setRemoveAttachments((p) => [...p, url])}
          />
        </FormField>

        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function AssignmentList({ batchId, onViewSubmissions }) {
  const listFn = (params) => trainerAssignmentsApi.list(batchId, params);
  const { items, total, totalPages, page, setPage, search, changeSearch, loading, error, refetch, handleDeleted } = useCrudResource(
    listFn,
    { limit: 10 }
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSubmit = async (values) => {
    if (editing) {
      await trainerAssignmentsApi.update(editing._id, values);
    } else {
      await trainerAssignmentsApi.create(batchId, values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await trainerAssignmentsApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete assignment'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'title', header: 'Title', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span className="line-clamp-1 max-w-xs text-slate-500">{stripHtml(row.description) || '—'}</span>,
    },
    { key: 'topic', header: 'Topic', render: (row) => row.topic || '—' },
    { key: 'dueDate', header: 'Due Date', render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—') },
    {
      key: 'submissions',
      header: '',
      render: (row) => (
        <button type="button" onClick={() => onViewSubmissions(row)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
          <Eye size={14} /> View ({row.submissionCount})
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <RowActions
          onEdit={() => {
            setEditing(row);
            setFormOpen(true);
          }}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by title" value={search} onChange={(e) => changeSearch(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Create Assignment
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No assignments yet'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <AssignmentFormDrawer open={formOpen} onClose={() => setFormOpen(false)} assignment={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Assignment"
        message={deleteError || `Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}

// Master/detail within the tab: list view, or one assignment's submissions
// (Clicking an assignment opens submissions) — no extra route needed.
export default function AssignmentsTab({ batchId }) {
  const [viewingAssignment, setViewingAssignment] = useState(null);

  if (viewingAssignment) {
    return <SubmissionsView assignment={viewingAssignment} onBack={() => setViewingAssignment(null)} />;
  }

  return <AssignmentList batchId={batchId} onViewSubmissions={setViewingAssignment} />;
}
