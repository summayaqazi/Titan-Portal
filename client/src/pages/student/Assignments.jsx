import { useEffect, useState } from 'react';
import { BookOpen, Calendar as CalendarIcon, FileText, Link2, Upload, AlertTriangle, Download, Info } from 'lucide-react';
import { PageContainer, EmptyState, StatusBadge, Textarea, Button, Input, MultiFileInput, Modal } from '../../components/common';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import { downloadUploadedFile, prettyFileName } from '../../utils/downloadFile';

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Small "type + Enter/Add to add a chip" input for submission links — same
// pattern as the Trainer Portal's Reference Links input (AssignmentsTab.jsx's
// TagListInput), duplicated locally rather than imported across the
// trainer/student portal boundary.
function LinkListInput({ values, onChange }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="Link to your work (optional) — https://…"
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
        <ul className="mt-2 space-y-1">
          {values.map((v, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              <span className="truncate">{v}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Shared file-list display for both an assignment's reference material and
// a student's own submitted files — each entry actually downloads (blob
// fetch + forced filename recovered from the stored path), not just opens
// in a new tab, and surfaces a clear message if a file is missing/broken.
function FileList({ files, emptyText }) {
  const [error, setError] = useState('');
  if (!files?.length) return emptyText ? <p className="text-xs text-slate-400">{emptyText}</p> : null;

  const handleDownload = async (url) => {
    setError('');
    try {
      await downloadUploadedFile(resolveFileUrl(url), prettyFileName(url));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <ul className="space-y-1">
        {files.map((url) => (
          <li key={url} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
            <span className="flex min-w-0 items-center gap-1.5">
              <FileText size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">{prettyFileName(url)}</span>
            </span>
            <button
              type="button"
              onClick={() => handleDownload(url)}
              className="flex shrink-0 items-center gap-1 font-medium text-primary-600 hover:underline"
            >
              <Download size={12} /> Download
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Read-only "Assignment Information" detail view — title/due date/grade/
// reference links/description, the same fields the card used to show
// inline, now behind an on-demand modal instead of always-expanded per
// card (this is what actually keeps the list itself compact). Submission
// (form, files, feedback, resubmit) stays exactly where it already was, on
// the card — this modal never touches that.
function AssignmentDetailModal({ assignment, onClose }) {
  if (!assignment) return null;
  const deadlineLabel = formatDeadline(assignment.dueDate);
  const referenceFiles = [...(assignment.referenceImages || []), ...(assignment.attachments || [])];

  return (
    <Modal open onClose={onClose} title="Assignment Information" size="xl">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Title</p>
          <p className="mt-1 text-base font-semibold text-slate-800">{assignment.title || 'Not provided'}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <CalendarIcon size={13} /> Due Date
            </p>
            <p className={`mt-1 text-sm font-medium ${assignment.expired ? 'text-red-600' : 'text-slate-700'}`}>
              {deadlineLabel || 'Not provided'}
              {assignment.expired ? ' (expired)' : ''}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Grade</p>
            <div className="mt-1.5">
              {/* "Not Submitted" is UI copy for the absence of a submission,
                  not a fabricated API status — real submission statuses
                  (pending/approved/rejected) still render via StatusBadge
                  exactly as the API returns them. */}
              <StatusBadge status={assignment.submission ? assignment.submission.status : 'Not Submitted'} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reference Links</p>
          {assignment.referenceLinks?.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {assignment.referenceLinks.map((link) => (
                <li key={link} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <Link2 size={14} className="mt-0.5 shrink-0 text-primary-600" />
                  <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-primary-600 hover:underline">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Not provided</p>
          )}
        </div>

        {referenceFiles.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Reference Material</p>
            <FileList files={referenceFiles} />
          </div>
        )}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Description</p>
          <div className="mt-1.5 rounded-lg bg-slate-50 p-3.5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{assignment.description || 'Not provided'}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AssignmentCard({ assignment, onSubmitted, onView }) {
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState([]);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { submission, expired, dueDate } = assignment;
  const deadlineLabel = formatDeadline(dueDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await studentPortalApi.submitAssignment(assignment._id, { description, links, files });
      setDescription('');
      setLinks([]);
      setFiles([]);
      setFormOpen(false);
      onSubmitted();
    } catch (err) {
      // The deadline can expire between page load and this click — the
      // backend is the real enforcement (see submitAssignment), this just
      // surfaces its rejection the same way any other error is shown.
      setError(getErrorMessage(err, 'Failed to submit assignment'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onView(assignment)} className="min-w-0 text-left">
          <p className="text-base font-semibold text-slate-800 hover:text-primary-700 hover:underline">{assignment.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {assignment.courseName} · {assignment.batchCode}
            {assignment.topic ? ` · ${assignment.topic}` : ''}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {submission && <StatusBadge status={submission.status} />}
          <button
            type="button"
            onClick={() => onView(assignment)}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Info size={12} /> View
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs font-medium">
        {expired ? <AlertTriangle size={13} className="text-red-600" /> : <CalendarIcon size={13} className="text-slate-400" />}
        <span className={expired ? 'text-red-600' : 'text-slate-500'}>
          {deadlineLabel ? `Deadline: ${deadlineLabel}` : 'No deadline set'}
          {expired ? ' (expired)' : ''}
        </span>
      </div>

      {submission && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Your Submission{submission.submittedAt && ` · ${new Date(submission.submittedAt).toLocaleString()}`}
          </p>
          {submission.description && <p className="mb-2 whitespace-pre-wrap text-sm text-slate-700">{submission.description}</p>}
          <FileList files={submission.files} emptyText="No files submitted" />
          {submission.links?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {submission.links.map((link) => (
                <li key={link} className="flex items-center gap-1.5 text-xs text-primary-600">
                  <Link2 size={12} />
                  <a href={link} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {submission.feedback && (
            <div className="mt-2 rounded-md bg-white p-2">
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">Feedback</p>
              <p className="text-sm text-slate-700">{submission.feedback}</p>
            </div>
          )}
          {!expired && (
            <button type="button" onClick={() => setFormOpen((p) => !p)} className="mt-2 text-xs font-medium text-primary-600 hover:underline">
              {formOpen ? 'Cancel' : 'Resubmit'}
            </button>
          )}
        </div>
      )}

      {!submission && expired && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={15} className="shrink-0" /> Submission deadline has expired.
        </div>
      )}

      {!expired && (!submission || formOpen) && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <Textarea rows={3} placeholder="Add a note (optional)…" value={description} onChange={(e) => setDescription(e.target.value)} />
          <LinkListInput values={links} onChange={setLinks} />
          <MultiFileInput label="Add files" files={files} onFilesChange={setFiles} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting}>
            <Upload size={15} /> {submitting ? 'Submitting…' : submission ? 'Resubmit' : 'Submit Assignment'}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Single shared instance for the whole list (not one modal per card) —
  // holds the assignment currently being viewed, or null when closed.
  const [viewingAssignment, setViewingAssignment] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    studentPortalApi
      .getAssignments()
      .then((data) => setAssignments(data))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load assignments')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <PageContainer title="Assignments" description="View and submit your assignments">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No assignments yet"
          description="Your trainer hasn't posted any assignments for your enrolled courses yet."
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => (
            <AssignmentCard key={a._id} assignment={a} onSubmitted={load} onView={setViewingAssignment} />
          ))}
        </div>
      )}

      <AssignmentDetailModal assignment={viewingAssignment} onClose={() => setViewingAssignment(null)} />
    </PageContainer>
  );
}
