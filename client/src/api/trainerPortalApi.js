import axiosInstance from './axiosInstance';

// Trainer's own portal endpoints — dashboard/calendar are read-only, scoped
// server-side to the logged-in trainer. Profile editing (name/phone/avatar,
// password) reuses the existing shared /auth/profile and /auth/password
// endpoints via profileApi.js — not duplicated here.
const trainerPortalApi = {
  getDashboard: () => axiosInstance.get('/trainer/me/dashboard').then((res) => res.data.data),
  getCalendar: (month, year) =>
    axiosInstance.get('/trainer/me/calendar', { params: { month, year } }).then((res) => res.data.data),
  // Bio + social links only — name/phone/avatar go through the shared
  // /auth/profile endpoint instead (see profileApi.js).
  updateProfile: (data) => axiosInstance.put('/trainer/me/profile', data).then((res) => res.data.data),

  getCourseWorkspace: (batchId) => axiosInstance.get(`/trainer/me/courses/${batchId}`).then((res) => res.data.data),
  getCourseStudents: (batchId, params) =>
    axiosInstance.get(`/trainer/me/courses/${batchId}/students`, { params }).then((res) => res.data),
  // Full read-only student profile + this batch's attendance/assignment/
  // quiz data for them — same underlying Student record Super Admin/Admin
  // manage (see trainerPortal.controller.js#getCourseStudentDetail).
  getCourseStudentDetail: (batchId, studentId) =>
    axiosInstance.get(`/trainer/me/courses/${batchId}/students/${studentId}`).then((res) => res.data.data),

  // Read-only — trainers view attendance, they never mark/update it (no
  // corresponding mark endpoint is exposed to this role at all).
  getAttendanceRoster: (batchId, date) =>
    axiosInstance.get('/trainer/me/attendance/roster', { params: { batch: batchId, date } }).then((res) => res.data.data),

  // The trainer's own check-in/check-out history — always their own record,
  // scoped server-side (see trainerPortal.routes.js).
  getAttendanceHistory: (params) => axiosInstance.get('/trainer/me/attendance-history', { params }).then((res) => res.data),
};

export default trainerPortalApi;
