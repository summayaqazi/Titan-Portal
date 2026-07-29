import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-(--color-app-bg) text-center">
      <h1 className="text-2xl font-semibold text-slate-800">Access denied</h1>
      <p className="mt-2 text-sm text-slate-500">You don't have permission to view this page.</p>
      <Link to="/login" className="mt-4 text-sm font-medium text-blue-600 hover:underline">
        Back to login
      </Link>
    </div>
  );
}
