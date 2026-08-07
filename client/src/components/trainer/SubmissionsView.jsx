import { useEffect, useState } from 'react';
import { ArrowLeft, Search, FileText, Link2, Check, X as XIcon, Users, CheckCircle2, Clock, XCircle, AlarmClockOff, Trash2 } from 'lucide-react';
import { Input, Button, Avatar, StatusBadge, EmptyState, Modal, Textarea, FormField, StatPill, ConfirmDialog } from '../common';
import trainerAssignmentsApi from '../../api/trainerAssignmentsApi';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';

const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

// A submission is late when it landed after the assignment's own due date —
// derived on the fly from data already fetched (no new field/endpoint).
const isLate = (submission, assignment) =>
  Boolean(assignment?.dueDate && submission?.submittedAt && new Date(submission.submittedAt) > new Date(assignment.dueDate));

// Still-pending-and-late submissions get this instead of the plain "Pending"
// badge, matching how a trainer actually needs to see it — reviewed
// submissions keep their normal Approved/Rejected badge regardless of
// lateness (that fact is already reflected in the "Late Submissions" stat).
function LateBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-white">
      <AlarmClockOff size={11} /> Late Submitted
    </span>
  );
}

function SubmissionStatusBadge({ submission, assignment }) {
  if (submission.status === 'pending' && isLate(submission, assignment)) return <LateBadge />;
  return <StatusBadge status={submission.status} />;
}

function FilePreview({ files }) {
  if (!files?.length) return <p className="text-sm text-slate-400">No files submitted</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {files.map((url) => {
        const isImage = IMAGE_RE.test(url);
        return (
          <a
            key={url}
            href={resolveFileUrl(url)}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-md border border-slate-200 hover:border-blue-300"
          >
            {isImage ? (
              <img src={resolveFileUrl(url)} alt={url} className="h-20 w-full object-cover" />
            ) : (
              <div className="flex h-20 flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400">
                <FileText size={20} />
                <span className="truncate px-1 text-[10px]">{url.split('/').pop()}</span>
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}

// `initialFeedback` pre-fills the box with whatever feedback already exists
// on the submission — reopening this modal on an already-reviewed
// submission is how a trainer edits/updates that feedback, not a blank slate.
function FeedbackModal({ open, onClose, action, initialFeedback, submitting, onConfirm }) {
  const [feedback, setFeedback] = useState('');
  const isEdit = Boolean(initialFeedback);

  useEffect(() => {
    if (open) setFeedback(initialFeedback || '');
  }, [open, initialFeedback]);

  const title = action === 'approved' ? (isEdit ? 'Edit Approval Feedback' : 'Approve Submission') : isEdit ? 'Edit Rejection Feedback' : 'Reject Submission';

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <FormField label="Feedback (optional)" htmlFor="feedback">
        <Textarea id="feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Add a note for the student…" />
      </FormField>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant={action === 'approved' ? 'primary' : 'danger'} onClick={() => onConfirm(feedback)} disabled={submitting}>
          {submitting ? 'Saving…' : action === 'approved' ? 'Approve' : 'Reject'}
        </Button>
      </div>
    </Modal>
  );
}

// Left panel (searchable submission list) + right panel (detail: files,
// links, submission time, feedback, approve/reject) for one assignment.
export default function SubmissionsView({ assignment, onBack }) {
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0, late: 0 });
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalAction, setModalAction] = useState(null); // 'approved' | 'rejected' | null
  const [reviewing, setReviewing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    trainerAssignmentsApi
      .getSubmissions(assignment._id, { search })
      .then((res) => {
        setStats(res.stats);
        setSubmissions(res.submissions);
        setSelectedId((prev) => (res.submissions.some((s) => s._id === prev) ? prev : res.submissions[0]?._id || null));
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load submissions')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment._id, search]);

  const selected = submissions.find((s) => s._id === selectedId) || null;

  const handleReview = async (feedback) => {
    setReviewing(true);
    try {
      await trainerAssignmentsApi.reviewSubmission(selected._id, modalAction, feedback);
      setModalAction(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save review'));
    } finally {
      setReviewing(false);
    }
  };

  const handleDeleteSubmission = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await trainerAssignmentsApi.deleteSubmission(deleteTarget._id);
      setDeleteTarget(null);
      setSuccessMessage('Submission deleted successfully');
      load();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete submission'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={12} /> Back to Assignments
      </button>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">{assignment.title} — Submissions</h2>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatPill icon={Users} label="Total Submissions" value={stats.total} colorClass="bg-blue-50 text-blue-600" />
        <StatPill icon={CheckCircle2} label="Approved" value={stats.approved} colorClass="bg-green-50 text-green-600" />
        <StatPill icon={XCircle} label="Not Approved" value={stats.rejected} colorClass="bg-red-50 text-red-600" />
        <StatPill icon={Clock} label="Pending" value={stats.pending} colorClass="bg-amber-50 text-amber-600" />
        <StatPill icon={AlarmClockOff} label="Late Submissions" value={stats.late} colorClass="bg-slate-100 text-slate-600" />
      </div>

      {successMessage && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMessage}</div>
      )}
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left: submission list */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input className="pl-8 text-sm" placeholder="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center text-sm text-slate-400">Loading…</p>
            ) : submissions.length === 0 ? (
              <EmptyState title="No submissions yet" />
            ) : (
              submissions.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => setSelectedId(s._id)}
                  className={`flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50 ${
                    selectedId === s._id ? 'bg-blue-50' : ''
                  }`}
                >
                  <Avatar src={resolveFileUrl(s.student?.user?.avatar)} name={s.student?.user?.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{s.student?.user?.name}</p>
                    <p className="truncate text-xs text-slate-400">{s.student?.user?.email}</p>
                  </div>
                  <SubmissionStatusBadge submission={s} assignment={assignment} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          {!selected ? (
            <EmptyState title="Select a submission to view details" />
          ) : (
            <div>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar src={resolveFileUrl(selected.student?.user?.avatar)} name={selected.student?.user?.name} size={44} />
                  <div>
                    <p className="text-base font-semibold text-slate-800">{selected.student?.user?.name}</p>
                    <p className="text-sm text-slate-500">{selected.student?.user?.email}</p>
                  </div>
                </div>
                <SubmissionStatusBadge submission={selected} assignment={assignment} />
              </div>

              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Submitted</p>
              <p className="mb-4 text-sm text-slate-600">
                {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : '—'}
              </p>

              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Description</p>
              <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{selected.description || '—'}</p>

              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Files</p>
              <div className="mb-4">
                <FilePreview files={selected.files} />
              </div>

              {selected.links?.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Links</p>
                  <ul className="space-y-1">
                    {selected.links.map((link) => (
                      <li key={link} className="flex items-center gap-1.5 text-sm text-blue-600">
                        <Link2 size={13} />
                        <a href={link} target="_blank" rel="noreferrer" className="truncate hover:underline">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.feedback && (
                <div className="mb-4 rounded-md bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Feedback {selected.feedbackBy?.name && `by ${selected.feedbackBy.name}`}
                  </p>
                  <p className="text-sm text-slate-700">{selected.feedback}</p>
                </div>
              )}

              <div className="flex gap-2 border-t border-slate-100 pt-4">
                <Button onClick={() => setModalAction('approved')}>
                  <Check size={15} /> Approve
                </Button>
                <Button variant="danger" onClick={() => setModalAction('rejected')}>
                  <XIcon size={15} /> Reject
                </Button>
                <Button variant="danger" onClick={() => setDeleteTarget(selected)}>
                  <Trash2 size={15} /> Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <FeedbackModal
        open={Boolean(modalAction)}
        onClose={() => setModalAction(null)}
        action={modalAction}
        initialFeedback={selected?.feedback}
        submitting={reviewing}
        onConfirm={handleReview}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDeleteSubmission}
        title="Delete Submission"
        message={deleteError || 'Are you sure you want to delete this assignment submission?'}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
