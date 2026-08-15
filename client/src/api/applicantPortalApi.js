import axiosInstance from './axiosInstance';

// Applicant's own portal endpoints (Phase 4 — dashboard/tracking, all
// read-only). Kept separate from applicantApi.js (Phase 3 — public
// registration + application submission), same split this codebase
// already uses elsewhere (studentsApi.js vs studentPortalApi.js): one file
// for the public/creation side, one for the authenticated own-portal side.
const applicantPortalApi = {
  getDashboard: () => axiosInstance.get('/applicant/me/dashboard').then((res) => res.data.data),

  listApplications: (params) => axiosInstance.get('/applicant/me/applications', { params }).then((res) => res.data),

  getApplication: (id) => axiosInstance.get(`/applicant/me/applications/${id}`).then((res) => res.data.data),

  // Not a raw link — the endpoint requires the Bearer token, so this is
  // consumed via the existing downloadFile() utility (client/src/utils/
  // downloadFile.js), same as every other protected file download in the
  // app (student audit PDF, CSV exports).
  resumeUrl: (id) => `/applicant/me/applications/${id}/resume`,
};

export default applicantPortalApi;
