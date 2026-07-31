import axiosInstance from './axiosInstance';

// Generic REST client for simple resources. Modules with extra endpoints
// (e.g. enrollments under students) spread this and add their own methods.
export default function createCrudApi(resource) {
  return {
    list: (params) => axiosInstance.get(`/${resource}`, { params }).then((res) => res.data),
    getOne: (id) => axiosInstance.get(`/${resource}/${id}`).then((res) => res.data.data),
    create: (data, config) => axiosInstance.post(`/${resource}`, data, config).then((res) => res.data.data),
    update: (id, data, config) =>
      axiosInstance.put(`/${resource}/${id}`, data, config).then((res) => res.data.data),
    remove: (id) => axiosInstance.delete(`/${resource}/${id}`).then((res) => res.data),
  };
}
