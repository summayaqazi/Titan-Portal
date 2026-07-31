import axiosInstance from './axiosInstance';

const paymentsApi = {
  list: (params) => axiosInstance.get('/payments', { params }).then((res) => res.data),
  create: (data) => axiosInstance.post('/payments', data).then((res) => res.data.data),
  update: (id, data) => axiosInstance.put(`/payments/${id}`, data).then((res) => res.data.data),
  remove: (id) => axiosInstance.delete(`/payments/${id}`).then((res) => res.data),
};

export default paymentsApi;
