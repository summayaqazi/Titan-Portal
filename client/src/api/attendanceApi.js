import axiosInstance from './axiosInstance';

const attendanceApi = {
  roster: (batch, date) => axiosInstance.get('/attendance/roster', { params: { batch, date } }).then((res) => res.data.data),
  mark: (batch, date, records) =>
    axiosInstance.post('/attendance/mark', { batch, date, records }).then((res) => res.data.data),
  multiMark: (date, rollNumbers, status, campus) =>
    axiosInstance.post('/attendance/multi-mark', { date, rollNumbers, status, campus }).then((res) => res.data.data),
  list: (params) => axiosInstance.get('/attendance', { params }).then((res) => res.data),
  remove: (id) => axiosInstance.delete(`/attendance/${id}`).then((res) => res.data),
  lookup: (rollNumber, batch, campus) =>
    axiosInstance.get('/attendance/lookup', { params: { rollNumber, batch, campus } }).then((res) => res.data.data),
  recent: (limit = 10, campus) =>
    axiosInstance.get('/attendance/recent', { params: { limit, campus } }).then((res) => res.data.data),
  summary: (enrollmentId) => axiosInstance.get(`/attendance/summary/${enrollmentId}`).then((res) => res.data.data),
  // Admin/Super Admin QR scanner (Student ID Card) — `campus` scopes it to
  // the Admin's own selected campus, same as lookup/multiMark above;
  // undefined for Super Admin, so it stays unrestricted.
  scanQr: (qrPayload, campus) => axiosInstance.post('/attendance/scan', { qrPayload, campus }).then((res) => res.data.data),
};

export default attendanceApi;
