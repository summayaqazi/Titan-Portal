import axiosInstance from './axiosInstance';

// One CourseProgress document per batch (lazily created server-side on
// first GET), modules/topics as sub-resources addressed by their own id —
// see trainerPortal.routes.js for why module/topic routes aren't nested
// under :batchId.
const trainerProgressApi = {
  get: (batchId) => axiosInstance.get(`/trainer/me/courses/${batchId}/progress`).then((res) => res.data.data),

  addModule: (batchId, title) =>
    axiosInstance.post(`/trainer/me/courses/${batchId}/progress/modules`, { title }).then((res) => res.data.data),
  updateModule: (moduleId, title) =>
    axiosInstance.put(`/trainer/me/progress/modules/${moduleId}`, { title }).then((res) => res.data.data),
  removeModule: (moduleId) => axiosInstance.delete(`/trainer/me/progress/modules/${moduleId}`).then((res) => res.data.data),

  addTopic: (moduleId, title) =>
    axiosInstance.post(`/trainer/me/progress/modules/${moduleId}/topics`, { title }).then((res) => res.data.data),
  updateTopic: (topicId, title) =>
    axiosInstance.put(`/trainer/me/progress/topics/${topicId}`, { title }).then((res) => res.data.data),
  toggleTopic: (topicId, completed) =>
    axiosInstance.patch(`/trainer/me/progress/topics/${topicId}/toggle`, { completed }).then((res) => res.data.data),
  removeTopic: (topicId) => axiosInstance.delete(`/trainer/me/progress/topics/${topicId}`).then((res) => res.data.data),
};

export default trainerProgressApi;
