import axiosInstance from './axiosInstance';

const trainerAttendanceApi = {
  list: (params) => axiosInstance.get('/trainer-attendance', { params }).then((res) => res.data),
  checkIn: (data) => axiosInstance.post('/trainer-attendance/check-in', data).then((res) => res.data.data),
  checkOut: (id, checkOutTime) =>
    axiosInstance.post(`/trainer-attendance/${id}/check-out`, { checkOutTime }).then((res) => res.data.data),
  verify: (id, action, remarks) =>
    axiosInstance.patch(`/trainer-attendance/${id}/verify`, { action, remarks }).then((res) => res.data.data),
  remove: (id) => axiosInstance.delete(`/trainer-attendance/${id}`).then((res) => res.data),
};

export default trainerAttendanceApi;
