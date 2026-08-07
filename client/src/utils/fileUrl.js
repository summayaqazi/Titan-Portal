// Resolves a server-relative upload path (e.g. "/uploads/xyz.png") into an
// absolute URL the browser can load directly (bypassing the API's /api
// prefix and auth interceptor, since static uploads aren't behind auth).
export function resolveFileUrl(path) {
  if (!path) return null;
  const base = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  return `${base}${path}`;
}
