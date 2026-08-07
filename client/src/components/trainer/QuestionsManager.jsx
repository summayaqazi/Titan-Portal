import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, CheckCircle2, CalendarClock, RotateCcw, X } from 'lucide-react';
import { Button, StatusBadge, EmptyState, Modal, FormField, Input, Select, Textarea, RowActions, ConfirmDialog } from '../common';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import trainerQuizzesApi from '../../api/trainerQuizzesApi';
import { getErrorMessage } from '../../utils/errors';

const TYPE_LABELS = { single: 'Single choice', multiple: 'Multiple choice', 'true-false': 'True / False' };
const emptyQuestionForm = { text: '', type: 'single', options: ['', ''], correctOptions: [], points: 1 };

function QuestionFormModal({ open, onClose, question, onSubmit }) {
  const [form, setForm] = useState(emptyQuestionForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(question);

  useEffect(() => {
    if (!open) return;
    setForm(
      question
        ? {
            text: question.text,
            type: question.type,
            options: question.type === 'true-false' ? ['True', 'False'] : question.options,
            correctOptions: question.correctOptions,
            points: question.points,
          }
        : emptyQuestionForm
    );
    setError('');
  }, [open, question]);

  const setType = (type) => {
    setForm((p) => ({
      ...p,
      type,
      options: type === 'true-false' ? ['True', 'False'] : p.options.length >= 2 ? p.options : ['', ''],
      correctOptions: [],
    }));
  };

  const setOption = (i, value) => {
    setForm((p) => ({ ...p, options: p.options.map((o, idx) => (idx === i ? value : o)) }));
  };

  const addOption = () => setForm((p) => ({ ...p, options: [...p.options, ''] }));

  const removeOption = (i) => {
    setForm((p) => ({
      ...p,
      options: p.options.filter((_, idx) => idx !== i),
      correctOptions: p.correctOptions.filter((idx) => idx !== i).map((idx) => (idx > i ? idx - 1 : idx)),
    }));
  };

  const toggleCorrect = (i) => {
    setForm((p) => {
      if (p.type === 'multiple') {
        const has = p.correctOptions.includes(i);
        return { ...p, correctOptions: has ? p.correctOptions.filter((idx) => idx !== i) : [...p.correctOptions, i] };
      }
      return { ...p, correctOptions: [i] };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.text.trim()) {
        setError('Question text is required');
        return;
      }
      if (form.type !== 'true-false' && form.options.filter((o) => o.trim()).length < 2) {
        setError('At least 2 options are required');
        return;
      }
      if (!form.correctOptions.length) {
        setError('Select at least one correct option');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit(form);
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save question'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Question' : 'Add Question'} size="lg">
      <form onSubmit={handleSubmit}>
        <FormField label="Question Text" htmlFor="q-text" required>
          <Textarea id="q-text" rows={2} value={form.text} onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type" htmlFor="q-type">
            <Select id="q-type" value={form.type} onChange={(e) => setType(e.target.value)}>
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
              <option value="true-false">True / False</option>
            </Select>
          </FormField>
          <FormField label="Points" htmlFor="q-points">
            <Input
              id="q-points"
              type="number"
              min={1}
              value={form.points}
              onChange={(e) => setForm((p) => ({ ...p, points: Number(e.target.value) }))}
            />
          </FormField>
        </div>

        <FormField label={form.type === 'multiple' ? 'Options (check all correct answers)' : 'Options (select the correct answer)'}>
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={form.type === 'multiple' ? 'checkbox' : 'radio'}
                  name="correct-option"
                  checked={form.correctOptions.includes(i)}
                  onChange={() => toggleCorrect(i)}
                  className="h-4 w-4"
                />
                {form.type === 'true-false' ? (
                  <span className="flex-1 text-sm text-slate-700">{opt}</span>
                ) : (
                  <>
                    <Input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                    {form.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="text-slate-400 hover:text-red-600">
                        <X size={15} />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          {form.type !== 'true-false' && (
            <Button type="button" variant="secondary" className="mt-2" onClick={addOption}>
              <Plus size={14} /> Add Option
            </Button>
          )}
        </FormField>

        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleModal({ open, onClose, onConfirm, submitting }) {
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setWhen('');
      setError('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (!when) {
      setError('Pick a date and time');
      return;
    }
    if (new Date(when) <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }
    setError('');
    onConfirm(new Date(when).toISOString());
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule Quiz" size="sm">
      <FormField label="Go live at" htmlFor="schedule-at" error={error}>
        <Input id="schedule-at" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </FormField>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Scheduling…' : 'Schedule'}
        </Button>
      </div>
    </Modal>
  );
}

// Detail view for one quiz: status/publish/schedule controls + full
// question CRUD. Reached from QuizzesTab's list ("Manage" link), same
// master/detail pattern as SubmissionsView for assignments.
export default function QuestionsManager({ quizId, onBack }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    trainerQuizzesApi
      .get(quizId)
      .then(setQuiz)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load quiz')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [quizId]);

  const handleSaveQuestion = async (values) => {
    const payload = { ...values, options: values.type === 'true-false' ? undefined : values.options.filter((o) => o.trim()) };
    const updated = editingQuestion
      ? await trainerQuizzesApi.updateQuestion(quizId, editingQuestion._id, payload)
      : await trainerQuizzesApi.addQuestion(quizId, payload);
    setQuiz(updated);
  };

  const handleDeleteQuestion = async () => {
    setDeleting(true);
    setActionError('');
    try {
      const updated = await trainerQuizzesApi.removeQuestion(quizId, deleteTarget._id);
      setQuiz(updated);
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to delete question'));
    } finally {
      setDeleting(false);
    }
  };

  const runAction = async (fn) => {
    setActionBusy(true);
    setActionError('');
    try {
      const updated = await fn();
      setQuiz(updated);
      setScheduleOpen(false);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Action failed'));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  if (!quiz) return null;

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={12} /> Back to Quizzes
      </button>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">{quiz.title}</h2>
              <StatusBadge status={quiz.status} />
            </div>
            {quiz.description && <p className="mb-1 max-w-xl text-sm text-slate-500">{quiz.description}</p>}
            <p className="text-xs text-slate-400">
              {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · {quiz.totalMarks} marks ·{' '}
              {quiz.durationMinutes} min
              {quiz.status === 'scheduled' && quiz.scheduledAt && ` · Live at ${new Date(quiz.scheduledAt).toLocaleString()}`}
              {quiz.status === 'published' && quiz.publishedAt && ` · Published ${new Date(quiz.publishedAt).toLocaleString()}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quiz.status !== 'published' && (
              <Button onClick={() => runAction(() => trainerQuizzesApi.publish(quizId))} disabled={actionBusy}>
                <CheckCircle2 size={15} /> Publish
              </Button>
            )}
            {quiz.status === 'draft' && (
              <Button variant="secondary" onClick={() => setScheduleOpen(true)} disabled={actionBusy}>
                <CalendarClock size={15} /> Schedule
              </Button>
            )}
            {quiz.status !== 'draft' && (
              <Button variant="secondary" onClick={() => runAction(() => trainerQuizzesApi.unpublish(quizId))} disabled={actionBusy}>
                <RotateCcw size={15} /> Move to Draft
              </Button>
            )}
          </div>
        </div>
        {actionError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Questions</h3>
        <Button
          onClick={() => {
            setEditingQuestion(null);
            setFormOpen(true);
          }}
        >
          <Plus size={15} /> Add Question
        </Button>
      </div>

      {quiz.questions.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <EmptyState title="No questions yet" description="Add at least one question before publishing or scheduling this quiz." />
        </div>
      ) : (
        <div className="space-y-3">
          {quiz.questions.map((q, i) => (
            <div key={q._id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {i + 1}. {q.text}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {TYPE_LABELS[q.type]} · {q.points} point{q.points === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {q.options.map((opt, idx) => (
                      <li
                        key={idx}
                        className={`text-sm ${q.correctOptions.includes(idx) ? 'font-medium text-green-700' : 'text-slate-600'}`}
                      >
                        {q.correctOptions.includes(idx) ? '✓ ' : '· '}
                        {opt}
                      </li>
                    ))}
                  </ul>
                </div>
                <RowActions
                  onEdit={() => {
                    setEditingQuestion(q);
                    setFormOpen(true);
                  }}
                  onDelete={() => setDeleteTarget(q)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <QuestionFormModal open={formOpen} onClose={() => setFormOpen(false)} question={editingQuestion} onSubmit={handleSaveQuestion} />

      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        submitting={actionBusy}
        onConfirm={(scheduledAt) => runAction(() => trainerQuizzesApi.schedule(quizId, scheduledAt))}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setActionError('');
        }}
        onConfirm={handleDeleteQuestion}
        title="Delete Question"
        message={actionError || 'Are you sure you want to delete this question? This cannot be undone.'}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
