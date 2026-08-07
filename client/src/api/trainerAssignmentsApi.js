import axiosInstance from './axiosInstance';

const toFormData = (data) => {
  const { referenceImageFiles, attachmentFiles, referenceLinks, removeReferenceImages, removeAttachments, ...rest } = data;
  const formData = new FormData();

  Object.entries(rest).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    formData.append(key, value);
  });

  (referenceLinks || []).forEach((v) => v && formData.append('referenceLinks', v));
  (removeReferenceImages || []).forEach((v) => formData.append('removeReferenceImages', v));
  (removeAttachments || []).forEach((v) => formData.append('removeAttachments', v));
  (referenceImageFiles || []).forEach((f) => formData.append('referenceImages', f));
  (attachmentFiles || []).forEach((f) => formData.append('attachments', f));

  return formData;
};

// Nested under a batch (Course Workspace), not a flat top-level resource —
// same shape as studentsApi.js's enrollmentsApi for the same reason.
const trainerAssignmentsApi = {
  list: (batchId, params) =>
    axiosInstance.get(`/trainer/me/courses/${batchId}/assignments`, { params }).then((res) => res.data),
  create: (batchId, data) =>
    axiosInstance.post(`/trainer/me/courses/${batchId}/assignments`, toFormData(data)).then((res) => res.data.data),
  update: (assignmentId, data) =>
    axiosInstance.put(`/trainer/me/assignments/${assignmentId}`, toFormData(data)).then((res) => res.data.data),
  remove: (assignmentId) => axiosInstance.delete(`/trainer/me/assignments/${assignmentId}`).then((res) => res.data),

  getSubmissions: (assignmentId, params) =>
    axiosInstance.get(`/trainer/me/assignments/${assignmentId}/submissions`, { params }).then((res) => res.data.data),
  reviewSubmission: (submissionId, status, feedback) =>
    axiosInstance
      .put(`/trainer/me/submissions/${submissionId}/review`, { status, feedback })
      .then((res) => res.data.data),
  deleteSubmission: (submissionId) =>
    axiosInstance.delete(`/trainer/me/submissions/${submissionId}`).then((res) => res.data),
};

export default trainerAssignmentsApi;
