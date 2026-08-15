import { useEffect, useState } from 'react';
import { Plus, Search, ListChecks } from 'lucide-react';
import { Table, Pagination, Input, Textarea, Button, Drawer, FormField, RowActions, StatusBadge, ConfirmDialog } from '../common';
import useCrudResource from '../../hooks/useCrudResource';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import trainerQuizzesApi from '../../api/trainerQuizzesApi';
import { getErrorMessage } from '../../utils/errors';
import QuestionsManager from './QuestionsManager';

const emptyForm = { title: '', description: '', durationMinutes: 30, startAt: '', endAt: '' };

// Same "YYYY-MM-DDTHH:mm in the browser's local time" conversion
// AssignmentsTab.jsx already uses for its own due-date field — duplicated
// locally rather than shared across files, matching that same precedent.
function toDatetimeLocalValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function QuizFormDrawer({ open, onClose, quiz, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(quiz);

  useEffect(() => {
    if (!open) return;
    setForm(
      quiz
        ? {
            title: quiz.title,
            description: quiz.description || '',
            durationMinutes: quiz.durationMinutes || 30,
            startAt: toDatetimeLocalValue(quiz.startAt),
            endAt: toDatetimeLocalValue(quiz.endAt),
          }
        : emptyForm
    );
    setError('');
  }, [open, quiz]);

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.title.trim()) {
        setError('Title is required');
        return;
      }
      if (form.startAt && form.endAt && new Date(form.endAt) <= new Date(form.startAt)) {
        setError('Quiz end date/time must be after the start date/time');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({
          ...form,
          startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
          endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save quiz'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Quiz' : 'Create Quiz'}
      width="w-[480px]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="quiz-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="quiz-form" onSubmit={handleSubmit}>
        <FormField label="Title" htmlFor="quiz-title" required>
          <Input id="quiz-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
        </FormField>

        <FormField label="Description">
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="What this quiz covers…"
          />
        </FormField>

        <FormField label="Duration (minutes)" htmlFor="quiz-duration">
          <Input
            id="quiz-duration"
            type="number"
            min={1}
            value={form.durationMinutes}
            onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
          />
        </FormField>

        {/* Availability window — a student can neither start, continue, nor
            submit outside [startAt, endAt] (enforced server-side; see
            studentPortal.controller.js#startQuizAttempt). Both optional —
            leaving them blank keeps a quiz available indefinitely once
            published, same as before this field existed. Stacks to one
            column on narrow screens instead of cramming two datetime-local
            inputs side by side. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Quiz Starts At" htmlFor="quiz-start-at">
            <Input
              id="quiz-start-at"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
            />
          </FormField>
          <FormField label="Quiz Ends At" htmlFor="quiz-end-at">
            <Input
              id="quiz-end-at"
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
            />
          </FormField>
        </div>
        <p className="-mt-2 mb-3 text-xs text-slate-400">
          Leave blank for no time restriction. Students cannot attempt the quiz before the start or after the end.
        </p>

        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

function QuizList({ batchId, onManage }) {
  const listFn = (params) => trainerQuizzesApi.list(batchId, params);
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
      await trainerQuizzesApi.update(editing._id, values);
    } else {
      await trainerQuizzesApi.create(batchId, values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await trainerQuizzesApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete quiz'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'title', header: 'Title', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'questions', header: 'Questions', render: (row) => row.questions?.length || 0 },
    { key: 'totalMarks', header: 'Marks', render: (row) => row.totalMarks ?? 0 },
    { key: 'durationMinutes', header: 'Duration', render: (row) => `${row.durationMinutes} min` },
    {
      key: 'when',
      header: 'Scheduled / Published',
      render: (row) =>
        row.status === 'scheduled' && row.scheduledAt
          ? new Date(row.scheduledAt).toLocaleString()
          : row.status === 'published' && row.publishedAt
          ? new Date(row.publishedAt).toLocaleString()
          : '—',
    },
    {
      key: 'manage',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => onManage(row)}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        >
          <ListChecks size={14} /> Manage
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
          <Plus size={16} /> Create Quiz
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No quizzes yet'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <QuizFormDrawer open={formOpen} onClose={() => setFormOpen(false)} quiz={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Quiz"
        message={deleteError || `Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}

// Master/detail within the tab: list view, or one quiz's question management
// + publish/schedule controls — no extra route needed (same pattern as
// AssignmentsTab <-> SubmissionsView).
export default function QuizzesTab({ batchId }) {
  const [managingQuiz, setManagingQuiz] = useState(null);

  if (managingQuiz) {
    return <QuestionsManager quizId={managingQuiz._id} onBack={() => setManagingQuiz(null)} />;
  }

  return <QuizList batchId={batchId} onManage={setManagingQuiz} />;
}
