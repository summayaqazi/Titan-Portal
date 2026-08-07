import axiosInstance from './axiosInstance';
import { downloadFile } from '../utils/downloadFile';

const paymentsApi = {
  list: (params) => axiosInstance.get('/payments', { params }).then((res) => res.data),
  create: (data) => axiosInstance.post('/payments', data).then((res) => res.data.data),
  update: (id, data) => axiosInstance.put(`/payments/${id}`, data).then((res) => res.data.data),
  remove: (id) => axiosInstance.delete(`/payments/${id}`).then((res) => res.data),
  generatePlan: (data) => axiosInstance.post('/payments/generate-plan', data).then((res) => res.data.data),
  regenerate: (id) => axiosInstance.post(`/payments/${id}/regenerate`).then((res) => res.data.data),
  downloadInvoice: (id, invoiceNumber) => downloadFile(`/payments/${id}/invoice`, `invoice-${invoiceNumber || id}.pdf`),
  downloadReceipt: (id, invoiceNumber) => downloadFile(`/payments/${id}/receipt`, `receipt-${invoiceNumber || id}.pdf`),
};

export default paymentsApi;
