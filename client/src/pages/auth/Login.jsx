import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, FormField, Input, BrandLogo } from '../../components/common';

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
          <BrandLogo
            size={56}
            className="mb-3"
            fallback={
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <GraduationCap size={24} />
              </span>
            }
          />
          <h1 className="text-lg font-semibold text-slate-800">Titan Institute Portal</h1>
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
            <Input
              id="password"
              type="password"
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
    default:
      return null;
  }
}
