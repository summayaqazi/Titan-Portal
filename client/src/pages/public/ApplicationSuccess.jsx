import { Link, Navigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { Button, StatusBadge } from '../../components/common';

// Confirmation page shown right after a successful
// POST /api/applicant/me/applications. Reads the just-created result from
// router state only (same pattern as RegisterSuccess.jsx) — never
// re-fetches or stores it, and never displays any private server path.
export default function ApplicationSuccess() {
  const location = useLocation();
  const result = location.state?.result;

  if (!result) {
    return <Navigate to="/jobs" replace />;
  }

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 size={34} className="text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Application Submitted</h1>
          <p className="mt-2 text-sm text-slate-500">Thank you for applying — your application has been received.</p>

          <div className="mt-6 space-y-3 rounded-md bg-slate-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Job</span>
              <span className="font-medium text-slate-700">{result.job?.title}</span>
            </div>
            {result.job?.city && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Location</span>
                <span className="font-medium text-slate-700">{result.job.city}</span>
              </div>
            )}
            {result.applicationMethod && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Applied Via</span>
                <span className="font-medium text-slate-700">{result.applicationMethod}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Applied On</span>
              <span className="font-medium text-slate-700">
                {result.appliedDate ? new Date(result.appliedDate).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status</span>
              <StatusBadge status={result.status} />
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Your application is <strong>pending review</strong>. The hiring team will reach out if you're shortlisted.
          </p>
          {/* No Applicant Dashboard exists yet (a later phase) — nothing to
              link to for tracking status yet, so this says so plainly
              instead of pointing at a route that isn't built. */}
          <p className="mt-2 text-xs text-slate-400">
            Application tracking isn't available yet — please keep this confirmation for your records.
          </p>

          <Link to="/jobs" className="mt-6 block">
            <Button variant="secondary" className="w-full">
              Browse more jobs
            </Button>
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
