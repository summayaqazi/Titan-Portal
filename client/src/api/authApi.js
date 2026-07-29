import axiosInstance from './axiosInstance';

export const loginRequest = (email, password) =>
  axiosInstance.post('/auth/login', { email, password }).then((res) => res.data);

export const getMeRequest = () => axiosInstance.get('/auth/me').then((res) => res.data);
