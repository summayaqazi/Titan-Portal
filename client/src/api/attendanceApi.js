import axiosInstance from './axiosInstance';

const attendanceApi = {
  roster: (batch, date) => axiosInstance.get('/attendance/roster', { params: { batch, date } }).then((res) => res.data.data),
  mark: (batch, date, records) =>
    axiosInstance.post('/attendance/mark', { batch, date, records }).then((res) => res.data.data),
  list: (params) => axiosInstance.get('/attendance', { params }).then((res) => res.data),
  remove: (id) => axiosInstance.delete(`/attendance/${id}`).then((res) => res.data),
};

export default attendanceApi;
