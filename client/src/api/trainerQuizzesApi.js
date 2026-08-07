import axiosInstance from './axiosInstance';

// Nested under a batch (Course Workspace), same shape as
// trainerAssignmentsApi.js — quizzes are plain JSON (no file uploads), so
// no FormData conversion is needed here.
const trainerQuizzesApi = {
  list: (batchId, params) => axiosInstance.get(`/trainer/me/courses/${batchId}/quizzes`, { params }).then((res) => res.data),
  get: (quizId) => axiosInstance.get(`/trainer/me/quizzes/${quizId}`).then((res) => res.data.data),
  create: (batchId, data) =>
    axiosInstance.post(`/trainer/me/courses/${batchId}/quizzes`, data).then((res) => res.data.data),
  update: (quizId, data) => axiosInstance.put(`/trainer/me/quizzes/${quizId}`, data).then((res) => res.data.data),
  remove: (quizId) => axiosInstance.delete(`/trainer/me/quizzes/${quizId}`).then((res) => res.data),

  publish: (quizId) => axiosInstance.put(`/trainer/me/quizzes/${quizId}/publish`).then((res) => res.data.data),
  schedule: (quizId, scheduledAt) =>
    axiosInstance.put(`/trainer/me/quizzes/${quizId}/schedule`, { scheduledAt }).then((res) => res.data.data),
  unpublish: (quizId) => axiosInstance.put(`/trainer/me/quizzes/${quizId}/unpublish`).then((res) => res.data.data),

  addQuestion: (quizId, data) =>
    axiosInstance.post(`/trainer/me/quizzes/${quizId}/questions`, data).then((res) => res.data.data),
  updateQuestion: (quizId, questionId, data) =>
    axiosInstance.put(`/trainer/me/quizzes/${quizId}/questions/${questionId}`, data).then((res) => res.data.data),
  removeQuestion: (quizId, questionId) =>
    axiosInstance.delete(`/trainer/me/quizzes/${quizId}/questions/${questionId}`).then((res) => res.data.data),
};

export default trainerQuizzesApi;
