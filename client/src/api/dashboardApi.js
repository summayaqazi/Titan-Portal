import axiosInstance from './axiosInstance';

// `campus` is optional everywhere here — omitted for Super Admin (global),
// passed by the Admin Portal's Dashboard campus selector to scope results
// (the server only ever honors it when it matches the caller's own
// assigned campus, see dashboard.controller.js).
export const getDashboardStats = ({ campus } = {}) =>
  axiosInstance.get('/dashboard/stats', { params: { campus } }).then((res) => res.data.data);

export const getCampusAnalytics = ({ sort = 'desc', page = 1, limit = 10, campus } = {}) =>
  axiosInstance
    .get('/dashboard/campus-analytics', { params: { sort, page, limit, campus } })
    .then((res) => res.data);

export const getCourseAnalytics = ({ sort = 'desc', page = 1, limit = 10, campus } = {}) =>
  axiosInstance
    .get('/dashboard/course-analytics', { params: { sort, page, limit, campus } })
    .then((res) => res.data);
