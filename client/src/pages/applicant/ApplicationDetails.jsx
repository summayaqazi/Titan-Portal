import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Languages,
  MapPin,
  Wallet,
} from 'lucide-react';
import { Button, StatusBadge, Avatar } from '../../components/common';
import applicantPortalApi from '../../api/applicantPortalApi';
import { downloadFile, prettyFileName } from '../../utils/downloadFile';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import { useAuth } from '../../context/AuthContext';

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

// Application Details — GET /api/applicant/me/applications/:id. Ownership
// is enforced entirely server-side (the query itself is scoped to the
// logged-in applicant); an id that exists but belongs to someone else
// returns the exact same 404 as a nonexistent one, surfaced here as the
// same "not found" error state either way.
export default function ApplicationDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setApplication(null);
    setError('');
    applicantPortalApi
      .getApplication(id)
      .then(setApplication)
      .catch((err) => setError(getErrorMessage(err, 'This application could not be found.')));
  }, [id]);

  const handleDownloadResume = async () => {
    setDownloadError('');
    setDownloading(true);
    try {
      await downloadFile(applicantPortalApi.resumeUrl(id), prettyFileName(application.resumeFilename));
    } catch {
      setDownloadError('Failed to download the resume. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const job = application?.job;

  return (
    <div className="p-4 sm:p-6">
      <Link
        to="/applicant/applications"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} /> Back to My Applications
      </Link>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {!error && !application && <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />}

      {application && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-lg font-semibold text-slate-800">{job?.title || 'Job no longer available'}</h1>
              <StatusBadge status={application.status} />
            </div>

            {job ? (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-slate-500 sm:grid-cols-2">
                  {job.city && (
                    <div className="flex items-center gap-1.5 font-medium text-slate-700">
                      <MapPin size={15} className="shrink-0" /> {job.city}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Briefcase size={15} className="shrink-0" /> {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                    {job.experience ? ` · ${job.experience}` : ''}
                  </div>
                  {job.qualification && (
                    <div className="flex items-center gap-1.5">
                      <GraduationCap size={15} className="shrink-0" /> {job.qualification}
                    </div>
                  )}
                  {job.expectedSalary && (
                    <div className="flex items-center gap-1.5">
                      <Wallet size={15} className="shrink-0" /> {job.expectedSalary}
                    </div>
                  )}
                  {job.languages?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Languages size={15} className="shrink-0" /> {job.languages.join(', ')}
                    </div>
                  )}
                  {job.openingDate && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={15} className="shrink-0" /> Opens {formatDate(job.openingDate)}
                    </div>
                  )}
                  {job.closingDate && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={15} className="shrink-0" /> Closes {formatDate(job.closingDate)}
                    </div>
                  )}
                </div>

                {job.about && <p className="mb-4 text-sm text-slate-600">{job.about}</p>}

                {job.description && (
                  <div className="mb-4">
                    <p className="mb-1 text-xs font-medium text-slate-400">Description</p>
                    <p className="whitespace-pre-line text-sm text-slate-600">{job.description}</p>
                  </div>
                )}

                {job.requirements?.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-1 text-xs font-medium text-slate-400">Requirements</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {job.requirements.map((req) => (
                        <li key={req}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {job.subjectCommand && (
                  <div className="mb-4">
                    <p className="mb-1 text-xs font-medium text-slate-400">Subject Command</p>
                    <p className="text-sm text-slate-600">{job.subjectCommand}</p>
                  </div>
                )}

                {job.skills?.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-1 text-xs font-medium text-slate-400">Skills</p>
                    <Pills items={job.skills} />
                  </div>
                )}

                {job.links?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-400">Important Links</p>
                    <ul className="space-y-1">
                      {job.links.map((link) => (
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
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">This job posting is no longer available.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              {/* The photo submitted with this application (Application.
                  photoPath) — distinct from, and never, the job's own
                  image. */}
              <Avatar src={resolveFileUrl(application.photoPath)} name={user?.name} size={44} />
              <h2 className="text-sm font-semibold text-slate-700">Your Application</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Application Date">{formatDate(application.appliedDate)}</Field>
              <Field label="Current Status">
                <StatusBadge status={application.status} />
              </Field>
              <Field label="Applied Via">{application.applicationMethod || '—'}</Field>
              <Field label="Qualification">{application.qualification || '—'}</Field>
              <Field label="Experience">{application.experience || '—'}</Field>
              <Field label="Subject Command">{application.subjectCommand || '—'}</Field>
              <Field label="Languages">
                <Pills items={application.languages} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Skills">
                <Pills items={application.skills} />
              </Field>
            </div>
            {application.links?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-400">Relevant Links</p>
                <ul className="mt-0.5 space-y-1">
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
              </div>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-1 text-xs font-medium text-slate-400">Resume / CV</p>
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
                <p className="text-sm text-slate-500">No resume was submitted for this application.</p>
              )}
              {downloadError && <p className="mt-2 text-xs text-red-600">{downloadError}</p>}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Status History</h2>
            {!application.history?.length ? (
              <p className="text-sm text-slate-500">No status history is available for this application yet.</p>
            ) : (
              <ol className="space-y-4">
                {application.history.map((entry, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                        <CheckCircle2 size={14} />
                      </span>
                      {i < application.history.length - 1 && <span className="mt-0.5 w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-slate-700">{STATUS_LABELS[entry.status] || entry.status}</p>
                      <p className="text-xs text-slate-400">{formatDate(entry.changedAt)}</p>
                      {entry.note && <p className="mt-0.5 text-xs text-slate-500">{entry.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
