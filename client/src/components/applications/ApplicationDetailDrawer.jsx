import { useState } from 'react';
import { CheckCircle2, Download, ExternalLink, FileText, Mail, Phone } from 'lucide-react';
import { Drawer, Button, StatusBadge, ConfirmDialog, Avatar } from '../common';
import { downloadFile, prettyFileName } from '../../utils/downloadFile';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import applicationsApi from '../../api/applicationsApi';

const JOB_TYPE_LABELS = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract' };
const STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  approved: 'Approved',
  rejected: 'Rejected',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Pills({ items }) {
  if (!items?.length) return <span className="text-sm text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          {item}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm text-slate-700">{children}</div>
    </div>
  );
}

// Super Admin's review view over one Application — applicant info, job
// info, submitted info, resume download, full status history, and the
// Shortlist/Approve/Reject/Under-Review actions (each just a different
// `status` value through the same PUT /api/applications/:id — same
// convention Enrollment's own status changes already use, not a second
// status system). Every action requires confirmation first.
export default function ApplicationDetailDrawer({ open, onClose, application, onChanged }) {
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null); // { status, label }
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  if (!application) return null;
  const job = application.job;
  const applicant = application.applicant;

  const handleDownloadResume = async () => {
    setDownloadError('');
    setDownloading(true);
    try {
      await downloadFile(applicationsApi.resumeUrl(application._id), prettyFileName(application.resumeFilename));
    } catch {
      setDownloadError('Failed to download the resume. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleStatusConfirm = async () => {
    setStatusSubmitting(true);
    setStatusError('');
    try {
      const updated = await applicationsApi.update(application._id, { status: statusTarget.status });
      setStatusTarget(null);
      onChanged?.(updated);
    } catch (err) {
      setStatusError(getErrorMessage(err, 'Failed to update status'));
    } finally {
      setStatusSubmitting(false);
    }
  };

  const actionsForStatus = {
    pending: [{ status: 'under_review', label: 'Move to Under Review' }],
    under_review: [
      { status: 'shortlisted', label: 'Shortlist' },
      { status: 'rejected', label: 'Reject', danger: true },
    ],
    shortlisted: [
      { status: 'approved', label: 'Approve' },
      { status: 'rejected', label: 'Reject', danger: true },
    ],
    approved: [],
    rejected: [],
  };
  const availableActions = actionsForStatus[application.status] || [];

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Application Details" width="w-[480px]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <StatusBadge status={application.status} />
          <span className="text-xs text-slate-400">Applied {formatDate(application.appliedDate)}</span>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-md bg-slate-50 p-3">
          {/* The applicant's own submitted photo (Application.photoPath) —
              distinct from, and never, the job's own image. */}
          <Avatar src={resolveFileUrl(application.photoPath)} name={applicant?.name} size={44} />
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Applicant</p>
            <p className="text-sm font-medium text-slate-800">{applicant?.name || '—'}</p>
            {applicant?.email && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Mail size={12} /> {applicant.email}
              </p>
            )}
            {applicant?.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Phone size={12} /> {applicant.phone}
              </p>
            )}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Job</p>
          <p className="text-sm font-medium text-slate-800">{job?.title || 'Job no longer available'}</p>
          {job && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              {JOB_TYPE_LABELS[job.jobType] || job.jobType}
              {job.city ? ` · ${job.city}` : ''} · <StatusBadge status={job.status} />
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Applied Via">{application.applicationMethod || '—'}</Field>
          <Field label="Qualification">{application.qualification || '—'}</Field>
          <Field label="Experience">{application.experience || '—'}</Field>
          <Field label="Subject Command">{application.subjectCommand || '—'}</Field>
          <Field label="Skills">
            <Pills items={application.skills} />
          </Field>
          <Field label="Languages">
            <Pills items={application.languages} />
          </Field>
          {application.links?.length > 0 && (
            <Field label="Relevant Links">
              <ul className="space-y-1">
                {application.links.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-700 hover:underline"
                    >
                      <ExternalLink size={13} className="shrink-0" />
                      <span className="break-all">{link}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Field>
          )}

          <Field label="Resume / CV">
            {application.hasResume ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-slate-700">
                  <FileText size={15} className="shrink-0 text-primary-600" />
                  {prettyFileName(application.resumeFilename)}
                </span>
                <Button variant="secondary" onClick={handleDownloadResume} disabled={downloading}>
                  <Download size={14} /> {downloading ? 'Downloading…' : 'Download'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No resume was submitted.</p>
            )}
            {downloadError && <p className="mt-2 text-xs text-red-600">{downloadError}</p>}
          </Field>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Status History</p>
          {!application.history?.length ? (
            <p className="text-sm text-slate-500">No status history available yet.</p>
          ) : (
            <ol className="space-y-3">
              {application.history.map((entry, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <CheckCircle2 size={12} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{STATUS_LABELS[entry.status] || entry.status}</p>
                    <p className="text-xs text-slate-400">{formatDate(entry.changedAt)}</p>
                    {entry.note && <p className="mt-0.5 text-xs text-slate-500">{entry.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {availableActions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {availableActions.map((action) => (
              <Button
                key={action.status}
                variant={action.danger ? 'danger' : 'primary'}
                onClick={() => setStatusTarget(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => {
          setStatusTarget(null);
          setStatusError('');
        }}
        onConfirm={handleStatusConfirm}
        title={statusTarget?.label}
        message={statusError || `Are you sure you want to "${statusTarget?.label}" this application? The applicant will see this updated status.`}
        confirmLabel={statusTarget?.label}
        loading={statusSubmitting}
        danger={Boolean(statusTarget?.danger)}
      />
    </>
  );
}
