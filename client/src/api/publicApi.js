import axiosInstance from './axiosInstance';

// Unauthenticated client for the public course discovery + registration
// flow (server/src/routes/public.routes.js). Deliberately its own module,
// not createCrudApi('...') — these endpoints don't take the auth token
// (axiosInstance attaches it automatically when present, which is harmless
// here since the routes ignore it) and `register` needs multipart/form-data
// for the profile picture, same as studentsApi.js's own create().
const publicApi = {
  listCourses: () => axiosInstance.get('/public/courses').then((res) => res.data.data),
  getCourse: (id) => axiosInstance.get(`/public/courses/${id}`).then((res) => res.data.data),
  register: (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      formData.append(key, value);
    });
    return axiosInstance.post('/public/register', formData).then((res) => res.data.data);
  },
};

export default publicApi;
