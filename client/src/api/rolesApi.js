import axiosInstance from './axiosInstance';
import createCrudApi from './createCrudApi';

const base = createCrudApi('roles');

const rolesApi = {
  ...base,
  summary: () => axiosInstance.get('/roles/summary').then((res) => res.data),
};

export default rolesApi;
