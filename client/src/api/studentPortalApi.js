import axiosInstance from './axiosInstance';

// Student's own portal endpoints — read-only, scoped server-side to the
// logged-in student. Phase 1: Dashboard only. Mirrors trainerPortalApi.js's
// shape/conventions.
const studentPortalApi = {
  getDashboard: () => axiosInstance.get('/student/me/dashboard').then((res) => res.data.data),
};

export default studentPortalApi;
