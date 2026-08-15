import axiosInstance from './axiosInstance';

// Unauthenticated client for the public Job Portal listing/details
// (server/src/routes/publicJob.routes.js). Kept isolated from
// publicApi.js — the existing public course/registration client — rather
// than added to it, mirroring the backend's own isolation.
const publicJobsApi = {
  // Resolves to the full paginatedResponse shape ({data, total, totalPages,
  // ...}) — matches what useCrudResource (the app's existing paginated-list
  // hook) already expects, same as every createCrudApi(...).list().
  list: (params) => axiosInstance.get('/public/jobs', { params }).then((res) => res.data),
  getOne: (id) => axiosInstance.get(`/public/jobs/${id}`).then((res) => res.data.data),
};

export default publicJobsApi;
