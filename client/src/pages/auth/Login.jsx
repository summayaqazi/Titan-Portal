import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, FormField, Input } from '../../components/common';

// Same show/hide pattern already used for password fields elsewhere
// (Super Admin/Trainer Profile's Change Password form) — reused here
// rather than a new one, so the eye icon looks and behaves identically
// across the app. Only the password field gets this; email is untouched.
function PasswordInput({ id, value, onChange, autoComplete, placeholder, required }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Navigate only once the AuthContext `user` state has actually committed
  // (not off the locally-resolved login() value), so route guards downstream
  // always see a fully-initialized auth state on the very first render of
  // the target route — no re-login/refresh needed.
  useEffect(() => {
    if (loggedIn && user) {
      // `location.state.from` is stamped by ProtectedRoute when it bounces a
      // logged-out visitor to /login (e.g. a deep link), so it's worth
      // honoring for that case — but it can just as easily be left over from
      // a *different* account's session ending here (logout reactively hits
      // the same redirect). Only trust it if it's actually a route the
      // just-authenticated role owns; otherwise a stale cross-role path
      // sends them straight into a RoleRoute rejection.
      const from = location.state?.from?.pathname;
      const prefix = rolePortalPrefix(user.role);
      const redirectTo = from && prefix && from.startsWith(prefix) ? from : defaultRouteForRole(user.role);
      navigate(redirectTo, { replace: true });
    }
  }, [loggedIn, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      setLoggedIn(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to log in. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-app-bg) px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* Same asset as the browser tab favicon (see index.html's
              <link rel="icon">) so the login page shows the exact same
              logo the tab does. */}
          <img src="/favicon-crest.png?v=1" alt="TITAN" className="mb-3 h-14 w-auto object-contain" />
          <h1 className="text-lg font-semibold text-slate-800">TITAN Institute</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your institute</p>
        </div>

        <form onSubmit={handleSubmit}>
          <FormField label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </FormField>

          <FormField label="Password" htmlFor="password" required>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </FormField>

          {error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {/* Entry point into the new public course/enrollment flow (Courses
            -> Course Details -> Register) for a visitor who doesn't have an
            account yet — additive only, doesn't change anything about the
            existing sign-in form above it. */}
        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{' '}
          <Link to="/courses" className="font-medium text-primary-700 hover:underline">
            Browse courses &amp; apply
          </Link>
        </p>
      </div>
    </div>
  );
}

function defaultRouteForRole(role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'TRAINER':
      return '/trainer';
    case 'STUDENT':
      return '/student';
    case 'APPLICANT':
      return '/applicant/dashboard';
    default:
      // Other roles authenticate successfully but have no portal built yet.
      return '/unauthorized';
  }
}

function rolePortalPrefix(role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin';
    case 'ADMIN':
      return '/admin';
    case 'TRAINER':
      return '/trainer';
    case 'STUDENT':
      return '/student';
    case 'APPLICANT':
      return '/applicant';
    default:
      return null;
  }
}
