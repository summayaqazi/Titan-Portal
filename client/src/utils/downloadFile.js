import axiosInstance from '../api/axiosInstance';

// Fetches a protected endpoint as a blob (auth header is Bearer-token-based,
// so a plain <a href> or window.open would 401) and saves it via a synthetic
// anchor. Used for PDF/CSV downloads (audit reports, invoices, receipts, exports).
export async function downloadFile(url, filename) {
  const response = await axiosInstance.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

// Recovers a human-readable name from a stored upload path. Multer (see
// upload.middleware.js) now stores files as
// "<timestamp>-<random>-<sanitized-original-name>.<ext>", so stripping that
// numeric prefix recovers the original filename for anything uploaded after
// that change; a file uploaded before it has no embedded name, so this
// falls back to the raw stored filename rather than guessing.
export function prettyFileName(url) {
  if (!url) return 'file';
  const raw = decodeURIComponent(url.split('/').pop());
  const match = raw.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : raw;
}

// Same mechanism as downloadFile() above, for an already-absolute upload
// URL (assignment/submission files are served outside /api — see
// resolveFileUrl) instead of a relative API endpoint. Surfaces a clear
// message for a missing/broken file instead of silently downloading an
// error page or failing invisibly.
export async function downloadUploadedFile(url, filename) {
  try {
    const response = await axiosInstance.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || prettyFileName(url);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error('This file could not be found on the server.');
    }
    throw new Error('Failed to download the file. Please try again.');
  }
}
