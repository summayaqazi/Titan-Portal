import axiosInstance from './axiosInstance';

// Student's own portal endpoints, scoped server-side to the logged-in
// student. Mirrors trainerPortalApi.js's shape/conventions.
const studentPortalApi = {
  getDashboard: () => axiosInstance.get('/student/me/dashboard').then((res) => res.data.data),

  getProgress: () => axiosInstance.get('/student/me/progress').then((res) => res.data.data),

  getAttendance: (month) =>
    axiosInstance.get('/student/me/attendance', { params: month ? { month } : {} }).then((res) => res.data.data),

  // `qrPayload` is the raw decoded QR text (a JSON string) — parsed and
  // verified entirely server-side (see markOwnAttendanceViaQr), never
  // trusted or re-validated here.
  scanAttendance: (qrPayload) =>
    axiosInstance.post('/student/me/attendance/scan', { qrPayload }).then((res) => res.data.data),

  getPayments: () => axiosInstance.get('/student/me/payments').then((res) => res.data.data),

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

  getQuizzes: () => axiosInstance.get('/student/me/quizzes').then((res) => res.data.data),

  getQuizInfo: (quizId) => axiosInstance.get(`/student/me/quizzes/${quizId}`).then((res) => res.data.data),

  // Starting is also how an already-running attempt is resumed (e.g. after
  // a page refresh) — the server returns the same attempt/deadline rather
  // than a new one, so this call is safe to repeat.
  startQuiz: (quizId) => axiosInstance.post(`/student/me/quizzes/${quizId}/start`).then((res) => res.data.data),

  // Periodic autosave while a quiz is in progress — never grades anything,
  // just persists answers-so-far so a resumed/refreshed session sees
  // up-to-date state.
  saveQuizProgress: (attemptId, answers) =>
    axiosInstance.put(`/student/me/quiz-attempts/${attemptId}/progress`, { answers }).then((res) => res.data.data),

  submitQuizAttempt: (attemptId, answers) =>
    axiosInstance.post(`/student/me/quiz-attempts/${attemptId}/submit`, { answers }).then((res) => res.data.data),

  getQuizAttempt: (attemptId) => axiosInstance.get(`/student/me/quiz-attempts/${attemptId}`).then((res) => res.data.data),

  // Keyed by enrollmentId, not courseId — see getCourseDetails' own
  // comment in studentPortal.controller.js for why (a student can hold
  // more than one enrollment for the same course).
  getCourseDetails: (enrollmentId) => axiosInstance.get(`/student/me/courses/${enrollmentId}`).then((res) => res.data.data),

  getMyProfile: () => axiosInstance.get('/student/me/profile').then((res) => res.data.data),

  // Student-level fields only (address/gender/dateOfBirth/highestQualification/
  // profilePicture) — name/phone/avatar go through the existing shared
  // updateProfileRequest (PUT /auth/profile, profileApi.js) instead, called
  // separately by the Profile page. See updateMyProfile's own comment in
  // studentPortal.controller.js for why the two are kept apart.
  updateMyProfile: ({ address, gender, dateOfBirth, highestQualification, profilePictureFile, removeProfilePicture }) => {
    const formData = new FormData();
    if (address !== undefined) formData.append('address', address);
    if (gender !== undefined) formData.append('gender', gender);
    if (dateOfBirth !== undefined) formData.append('dateOfBirth', dateOfBirth);
    if (highestQualification !== undefined) formData.append('highestQualification', highestQualification);
    if (profilePictureFile) formData.append('profilePicture', profilePictureFile);
    else if (removeProfilePicture) formData.append('removeProfilePicture', 'true');
    return axiosInstance.put('/student/me/profile', formData).then((res) => res.data.data);
  },

  submitFeedback: ({ type, message, images }) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('message', message);
    (images || []).forEach((f) => formData.append('images', f));
    return axiosInstance.post('/student/me/feedback', formData).then((res) => res.data.data);
  },
};

export default studentPortalApi;
