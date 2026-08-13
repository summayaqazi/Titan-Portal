import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CalendarDays, ExternalLink, GraduationCap, Info, Languages, Wallet } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import { Button, StatusBadge } from '../../components/common';
import publicJobsApi from '../../api/publicJobsApi';

const JOB_TYPE_LABELS = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
};

const APPLICATION_STATE_COPY = {
  open: { badge: 'open', message: null },
  upcoming: { badge: 'upcoming', message: 'Applications for this role open soon — please check back closer to the opening date.' },
  closed: { badge: 'closed', message: 'This role is no longer accepting applications.' },
};

function Pills({ items }) {
  if (!items?.length) return null;
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

function Section({ title, children }) {
  if (!children) return null;
  return (
    <div className="border-t border-slate-200 py-5 first:border-t-0 first:pt-0">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

// Public Job Details page — GET /api/public/jobs/:id. Reachable for a
// closed job too (shows a closed state instead of a bare error); never for
// a draft job (server returns 404 the same as a nonexistent id).
//
// Phase 3 minimal integration: Apply Now now navigates into the real
// application flow (JobApply.jsx) instead of Phase 2's "coming soon"
// placeholder. Nothing else on this page changed — search/filters/
// pagination live on Jobs.jsx, untouched, and every other field/section
// here is exactly as Phase 2 shipped it.
export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setJob(null);
    setError('');
    publicJobsApi
      .getOne(id)
      .then(setJob)
      .catch((err) => setError(err.response?.data?.message || 'This job could not be found.'));
  }, [id]);

  const stateCopy = job ? APPLICATION_STATE_COPY[job.applicationState] || APPLICATION_STATE_COPY.closed : null;

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to="/jobs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} /> Back to jobs
        </Link>

        {error && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!error && !job && <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />}

        {job && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-6 sm:p-8">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={stateCopy.badge} />
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  <Briefcase size={12} /> {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                </span>
              </div>
              <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">{job.title}</h1>
              {job.about && <p className="mt-3 text-sm leading-relaxed text-slate-600">{job.about}</p>}

              <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-500 sm:grid-cols-2">
                {job.experience && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase size={15} className="shrink-0" /> <span>{job.experience} experience</span>
                  </div>
                )}
                {job.qualification && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap size={15} className="shrink-0" /> <span>{job.qualification}</span>
                  </div>
                )}
                {job.expectedSalary && (
                  <div className="flex items-center gap-1.5">
                    <Wallet size={15} className="shrink-0" /> <span>{job.expectedSalary}</span>
                  </div>
                )}
                {job.languages?.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Languages size={15} className="shrink-0" /> <span>{job.languages.join(', ')}</span>
                  </div>
                )}
                {job.openingDate && (
                  <div className="flex items-center gap-1.5">
                    <CalendarDays size={15} className="shrink-0" />
                    <span>Opens {new Date(job.openingDate).toLocaleDateString()}</span>
                  </div>
                )}
                {job.closingDate && (
                  <div className="flex items-center gap-1.5">
                    <CalendarDays size={15} className="shrink-0" />
                    <span>Closes {new Date(job.closingDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 sm:px-8">
              <Section title="Description">
                {job.description && <p className="whitespace-pre-line text-sm text-slate-600">{job.description}</p>}
              </Section>

              <Section title="Requirements">
                {job.requirements?.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {job.requirements.map((req) => (
                      <li key={req}>{req}</li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Subject Command">
                {job.subjectCommand && <p className="text-sm text-slate-600">{job.subjectCommand}</p>}
              </Section>

              <Section title="Skills">
                <Pills items={job.skills} />
              </Section>

              <Section title="Important Links">
                {job.links?.length > 0 && (
                  <ul className="space-y-1.5">
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
                )}
              </Section>
            </div>

            <div className="border-t border-slate-200 p-6 sm:p-8">
              {job.resumeRequired && (
                <p className="mb-3 flex items-start gap-1.5 text-xs text-slate-400">
                  <Info size={14} className="mt-0.5 shrink-0" />A resume/CV will be required to apply for this role.
                </p>
              )}
              <Button
                onClick={() => navigate(`/jobs/${id}/apply`)}
                disabled={job.applicationState !== 'open'}
                className="w-full sm:w-auto"
              >
                {job.applicationState === 'open' ? 'Apply Now' : job.applicationState === 'upcoming' ? 'Applications Open Soon' : 'Applications Closed'}
              </Button>
              {stateCopy.message && <p className="mt-2 text-xs text-slate-500">{stateCopy.message}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
