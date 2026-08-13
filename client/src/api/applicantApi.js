import axiosInstance from './axiosInstance';

// Applicant account creation + application submission. Registration is
// unauthenticated; submission requires the caller to already be logged in
// as an APPLICANT (axiosInstance attaches the token automatically once
// AuthContext.login() has run — see JobApply.jsx for how the two connect).
const applicantApi = {
  register: (data) => axiosInstance.post('/public/applicant/register', data).then((res) => res.data),
  // `data`'s array-ish fields (skills/languages/links) are expected as
  // comma-separated strings already — the caller joins them before calling
  // this, so the server always receives one predictable string per field
  // (applicantPortal.controller.js's own toArray then splits it back out).
  submitApplication: (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      formData.append(key, value);
    });
    return axiosInstance.post('/applicant/me/applications', formData).then((res) => res.data.data);
  },
};

export default applicantApi;
