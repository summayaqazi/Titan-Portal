import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, CheckCircle2, Clock, Eye, ListChecks, MapPin, Search, XCircle } from 'lucide-react';
import { PageContainer, EmptyState, StatusBadge, Button } from '../../components/common';
import StatCard from '../../components/dashboard/StatCard';
import applicantPortalApi from '../../api/applicantPortalApi';
import { getErrorMessage } from '../../utils/errors';
import { useAuth } from '../../context/AuthContext';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Applicant Dashboard — GET /api/applicant/me/dashboard, scoped server-side
// to the logged-in applicant. Every count/row here is live data; nothing
// hardcoded.
export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    applicantPortalApi
      .getDashboard()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load dashboard'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = data?.counts || { total: 0, pending: 0, under_review: 0, shortlisted: 0, approved: 0, rejected: 0 };
  const recent = data?.recent || [];

  return (
    <PageContainer
      title="Dashboard"
      description={`Welcome back, ${user?.name || 'there'} — track the jobs you've applied for`}
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total Applications" icon={Briefcase} value={loading ? '—' : counts.total} iconClassName="bg-primary-50 text-primary-600" />
            <StatCard label="Pending" icon={Clock} value={loading ? '—' : counts.pending} iconClassName="bg-amber-50 text-amber-600" />
            <StatCard label="Under Review" icon={Search} value={loading ? '—' : counts.under_review} iconClassName="bg-blue-50 text-blue-600" />
            <StatCard label="Shortlisted" icon={ListChecks} value={loading ? '—' : counts.shortlisted} iconClassName="bg-violet-50 text-violet-600" />
            <StatCard label="Approved" icon={CheckCircle2} value={loading ? '—' : counts.approved} iconClassName="bg-green-50 text-green-600" />
            <StatCard label="Rejected" icon={XCircle} value={loading ? '—' : counts.rejected} iconClassName="bg-red-50 text-red-600" />
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Recent Applications</h2>
              {!loading && recent.length > 0 && (
                <Link to="/applicant/applications" className="text-xs font-medium text-primary-600 hover:underline">
                  View all
                </Link>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : recent.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white">
                <EmptyState
                  icon={Briefcase}
                  title="You have not applied for any jobs yet"
                  description="Browse open positions and submit your first application."
                />
                <div className="flex justify-center pb-6">
                  <Link to="/jobs">
                    <Button variant="secondary">Browse Jobs</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="px-4 py-2.5 font-medium">Job Title</th>
                        <th className="px-4 py-2.5 font-medium">City</th>
                        <th className="px-4 py-2.5 font-medium">Applied Date</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((application) => (
                        <tr key={application._id} className="border-b border-slate-100 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-slate-700">
                            {application.job?.title || 'Job no longer available'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {application.job?.city ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} className="shrink-0 text-slate-400" /> {application.job.city}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{formatDate(application.appliedDate)}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={application.status} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link
                              to={`/applicant/applications/${application._id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                            >
                              <Eye size={13} /> View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
