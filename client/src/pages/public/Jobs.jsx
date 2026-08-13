import { Link } from 'react-router-dom';
import { Briefcase, Clock, GraduationCap, Search, Wallet } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import { EmptyState, Input, Pagination, Select, StatusBadge } from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import publicJobsApi from '../../api/publicJobsApi';

const JOB_TYPE_LABELS = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
};

// Public, unauthenticated Job Portal listing — GET /api/public/jobs
// (server/src/controllers/publicJob.controller.js), which already only
// returns jobs that are status='open' AND within their opening/closing
// window — never hardcoded, never mock data. Reuses useCrudResource, the
// same debounced-search + server-side-pagination hook every Admin/Super
// Admin list page already uses, rather than a second pagination
// implementation.
export default function Jobs() {
  const { items, total, totalPages, page, setPage, search, changeSearch, filters, setFilter, loading, error } =
    useCrudResource(publicJobsApi.list, { limit: 9 });

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">Careers at TITAN</h1>
          <p className="mt-1 text-sm text-slate-500">Browse current openings and find your next role.</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by title, qualification, skills…"
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
          </div>
          <Select
            className="w-full max-w-[10rem]"
            value={filters.jobType || ''}
            onChange={(e) => setFilter('jobType', e.target.value || undefined)}
          >
            <option value="">All job types</option>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
          </Select>
        </div>

        {error && <p className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white">
            <EmptyState
              icon={Briefcase}
              title="No openings match right now"
              description="Try a different search, or check back soon for new opportunities."
            />
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              {items.map((job) => (
                <Link
                  key={job._id}
                  to={`/jobs/${job._id}`}
                  className="flex flex-col rounded-lg border border-slate-200 p-5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-slate-800">{job.title}</h2>
                    <StatusBadge status="open" />
                  </div>
                  {job.about && <p className="mb-4 line-clamp-2 flex-1 text-sm text-slate-500">{job.about}</p>}

                  {job.skills?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {job.skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          +{job.skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Briefcase size={14} className="shrink-0" />
                      <span>{JOB_TYPE_LABELS[job.jobType] || job.jobType}</span>
                      {job.experience && <span>· {job.experience}</span>}
                    </div>
                    {job.qualification && (
                      <div className="flex items-center gap-1.5">
                        <GraduationCap size={14} className="shrink-0" />
                        <span className="truncate">{job.qualification}</span>
                      </div>
                    )}
                    {job.expectedSalary && (
                      <div className="flex items-center gap-1.5">
                        <Wallet size={14} className="shrink-0" />
                        <span className="truncate">{job.expectedSalary}</span>
                      </div>
                    )}
                    {job.closingDate && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="shrink-0" />
                        <span>Closes {new Date(job.closingDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </div>
        )}
      </main>
    </div>
  );
}
