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
