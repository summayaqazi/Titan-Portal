import axiosInstance from './axiosInstance';

export const updateProfileRequest = (data) => {
  const { avatarFile, removeAvatar, ...rest } = data;
  const formData = new FormData();
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (avatarFile) formData.append('avatar', avatarFile);
  else if (removeAvatar) formData.append('removeAvatar', 'true');
  return axiosInstance.put('/auth/profile', formData).then((res) => res.data.user);
};

export const changePasswordRequest = (currentPassword, newPassword) =>
  axiosInstance.put('/auth/password', { currentPassword, newPassword }).then((res) => res.data);
