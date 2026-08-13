import createCrudApi from './createCrudApi';

// Super Admin Application Management (Job Portal Phase 5) — review, status
// changes (shortlist/approve/reject all go through the generic update()
// below with a `status` value, same convention Enrollment already uses),
// and resume download. Kept entirely separate from applicantPortalApi.js
// (the Applicant's own read-only view over the same Application
// collection) and applicantApi.js (public registration/submission).
const applicationsApi = {
  ...createCrudApi('applications'),
  // Protected endpoint (Bearer token) — consumed via the existing
  // downloadFile() utility, same as every other protected file download.
  resumeUrl: (id) => `/applications/${id}/resume`,
};

export default applicationsApi;
