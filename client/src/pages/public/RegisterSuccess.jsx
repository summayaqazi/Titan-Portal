import { Link, Navigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import { Button, StatusBadge } from '../../components/common';

// Confirmation page shown right after a successful POST /api/public/register.
// Reads the just-created result from router state only (never re-fetches or
// stores it) — a page refresh loses it by design, same as any other
// one-time "thank you" screen, so nothing sensitive lingers in the URL or
// browser history beyond this one navigation.
export default function RegisterSuccess() {
  const location = useLocation();
  const result = location.state?.result;

  if (!result) {
    // Reached directly (refresh, bookmark, back button) with nothing to
    // show — send the visitor back to a page that actually has content
    // rather than a blank confirmation screen.
    return <Navigate to="/courses" replace />;
  }

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center sm:p-8">
          <CheckCircle2 size={40} className="mx-auto mb-4 text-green-600" />
          <h1 className="text-xl font-semibold text-slate-800">Registration Successful</h1>
          <p className="mt-2 text-sm text-slate-500">
            Thank you, {result.applicant?.name}. Your application has been received.
          </p>

          <div className="mt-6 space-y-3 rounded-md bg-slate-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Application Status</span>
              <StatusBadge status={result.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Course</span>
              <span className="font-medium text-slate-700">{result.course?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Batch</span>
              <span className="font-medium text-slate-700">{result.batch?.batchCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-700">{result.applicant?.email}</span>
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Your application is now <strong>pending review</strong> by the institute's admissions team. Once it is
            approved, you'll be able to sign in to the Student Portal with the email and password you just set.
          </p>

          <Link to="/login" className="mt-6 block">
            <Button variant="secondary" className="w-full">
              Go to Login
            </Button>
          </Link>
          <Link to="/courses" className="mt-3 block text-sm text-slate-500 hover:text-slate-700">
            Browse more courses
          </Link>
        </div>
      </main>
    </div>
  );
}
