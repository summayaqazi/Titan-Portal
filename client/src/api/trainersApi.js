import axiosInstance from './axiosInstance';
import createCrudApi from './createCrudApi';

const base = createCrudApi('trainers');

const toFormData = (data) => {
  const { profileImageFile, removeProfileImage, campuses, courses, socialLinks, specialization, ...rest } = data;
  const formData = new FormData();

  Object.entries(rest).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    formData.append(key, value);
  });

  (campuses || []).forEach((id) => formData.append('campuses', id));
  (courses || []).forEach((id) => formData.append('courses', id));
  (specialization || []).forEach((s) => formData.append('specialization', s));
  Object.entries(socialLinks || {}).forEach(([key, value]) => {
    if (value) formData.append(`socialLinks[${key}]`, value);
  });
  if (profileImageFile) formData.append('profileImage', profileImageFile);
  else if (removeProfileImage) formData.append('removeProfileImage', 'true');

  return formData;
};

const trainersApi = {
  ...base,
  create: (data) => axiosInstance.post('/trainers', toFormData(data)).then((res) => res.data.data),
  update: (id, data) => axiosInstance.put(`/trainers/${id}`, toFormData(data)).then((res) => res.data.data),
};

export default trainersApi;
