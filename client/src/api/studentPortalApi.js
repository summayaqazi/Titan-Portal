import axiosInstance from './axiosInstance';

// Student's own portal endpoints, scoped server-side to the logged-in
// student. Mirrors trainerPortalApi.js's shape/conventions.
const studentPortalApi = {
  getDashboard: () => axiosInstance.get('/student/me/dashboard').then((res) => res.data.data),

  getAssignments: () => axiosInstance.get('/student/me/assignments').then((res) => res.data.data),

  // FormData, not JSON — mirrors trainerAssignmentsApi's toFormData for the
  // same reason (real File objects for `files`).
  submitAssignment: (assignmentId, { description, links, files }) => {
    const formData = new FormData();
    if (description) formData.append('description', description);
    (links || []).forEach((v) => v && formData.append('links', v));
    (files || []).forEach((f) => formData.append('files', f));
    return axiosInstance
      .post(`/student/me/assignments/${assignmentId}/submit`, formData)
      .then((res) => res.data.data);
  },
};

export default studentPortalApi;
