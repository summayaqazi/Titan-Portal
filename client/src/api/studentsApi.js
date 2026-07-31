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
    const { profilePictureFile, ...rest } = data;
    const formData = toFormData(rest);
    if (profilePictureFile) formData.append('profilePicture', profilePictureFile);
    return axiosInstance.post('/students', formData).then((res) => res.data.data);
  },
  update: (id, data) => {
    const { profilePictureFile, ...rest } = data;
    const formData = toFormData(rest);
    if (profilePictureFile) formData.append('profilePicture', profilePictureFile);
    return axiosInstance.put(`/students/${id}`, formData).then((res) => res.data.data);
  },
};

export default studentsApi;

export const enrollmentsApi = {
  listForStudent: (studentId) =>
    axiosInstance.get(`/students/${studentId}/enrollments`).then((res) => res.data.data),
  create: (studentId, data) =>
    axiosInstance.post(`/students/${studentId}/enrollments`, data).then((res) => res.data.data),
  update: (id, data) => axiosInstance.put(`/enrollments/${id}`, data).then((res) => res.data.data),
  remove: (id) => axiosInstance.delete(`/enrollments/${id}`).then((res) => res.data),
};
