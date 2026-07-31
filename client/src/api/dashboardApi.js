import axiosInstance from './axiosInstance';

export const getDashboardStats = () =>
  axiosInstance.get('/dashboard/stats').then((res) => res.data.data);

export const getCampusAnalytics = ({ sort = 'desc', page = 1, limit = 10 } = {}) =>
  axiosInstance
    .get('/dashboard/campus-analytics', { params: { sort, page, limit } })
    .then((res) => res.data);

export const getCourseAnalytics = ({ sort = 'desc', page = 1, limit = 10 } = {}) =>
  axiosInstance
    .get('/dashboard/course-analytics', { params: { sort, page, limit } })
    .then((res) => res.data);
