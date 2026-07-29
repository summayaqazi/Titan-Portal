import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-(--color-app-bg) text-center">
      <h1 className="text-4xl font-semibold text-slate-800">404</h1>
      <p className="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-4 text-sm font-medium text-blue-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
