import { createContext, useContext, useEffect, useState } from 'react';
import { loginRequest, getMeRequest } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser) {
      // Optimistic hydration so a refresh doesn't flash a blank screen —
      // but this cached copy can be stale (e.g. left over from a different
      // account that was signed into this browser earlier), so `loading`
      // is NOT cleared here. Route guards must keep waiting until the
      // server confirms it below.
      setUser(JSON.parse(storedUser));
    }

    if (!token) {
      setLoading(false);
      return;
    }

    // Confirm the session against /auth/me before any route guard is
    // allowed to evaluate role/permission checks. This also picks up
    // permission changes made on the Roles & Permissions page without
    // requiring re-login. Guarded against the token that was current when
    // we fetched: if a fresh login (or logout) happens while this request
    // is in flight, the token in storage will have moved on by the time it
    // resolves, and this now-stale response must be discarded instead of
    // clobbering the newer session with the account it was originally
    // fetched for.
    getMeRequest()
      .then((data) => {
        if (localStorage.getItem('token') !== token) return;
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await loginRequest(email, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Admin Portal Dashboard's remembered campus selection — must not
    // survive into a different account logging in on the same browser.
    localStorage.removeItem('admin_dashboard_campus');
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  // Permission check: module/action against the resolved permission map from
  // login/getMe. Falls back to false (deny) when permissions haven't loaded
  // yet or the module/action is unknown.
  const can = (module, action) => Boolean(user?.permissions?.[module]?.[action]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
