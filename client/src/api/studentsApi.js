import axiosInstance from './axiosInstance';
import createCrudApi from './createCrudApi';

const base = createCrudApi('students');

const toFormData = (data) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    formData.append(key, value);
  });
  return formData;
};

const studentsApi = {
  ...base,
  create: (data) => {
    const { profilePictureFile, removeProfilePicture: _removeProfilePicture, ...rest } = data;
    const formData = toFormData(rest);
    if (profilePictureFile) formData.append('profilePicture', profilePictureFile);
    return axiosInstance.post('/students', formData).then((res) => res.data.data);
  },
  update: (id, data) => {
    const { profilePictureFile, removeProfilePicture, ...rest } = data;
    const formData = toFormData(rest);
    if (profilePictureFile) formData.append('profilePicture', profilePictureFile);
    else if (removeProfilePicture) formData.append('removeProfilePicture', 'true');
    return axiosInstance.put(`/students/${id}`, formData).then((res) => res.data.data);
  },
  verifyCnic: (id) => axiosInstance.patch(`/students/${id}/verify-cnic`).then((res) => res.data.data),
  auditPdfUrl: (id) => `/students/${id}/audit-pdf`,
  exportUrl: (params) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return `/students/export${query ? `?${query}` : ''}`;
  },
};

export default studentsApi;

export const enrollmentsApi = {
  listForStudent: (studentId, params) =>
    axiosInstance.get(`/students/${studentId}/enrollments`, { params }).then((res) => res.data.data),
  create: (studentId, data) =>
    axiosInstance.post(`/students/${studentId}/enrollments`, data).then((res) => res.data.data),
  update: (id, data) => axiosInstance.put(`/enrollments/${id}`, data).then((res) => res.data.data),
  remove: (id) => axiosInstance.delete(`/enrollments/${id}`).then((res) => res.data),
  bulkUpdateStatus: (rollNumbers, status) =>
    axiosInstance.post('/enrollments/bulk-status', { rollNumbers, status }).then((res) => res.data.data),
};
