import axiosInstance from './axiosInstance';
import createCrudApi from './createCrudApi';

const base = createCrudApi('registrations');

// Super Admin (+ campus-scoped Admin) Registration review — a Registration
// is a public course-registration submission awaiting approval, reviewed
// entirely separately from studentsApi.js's own Student records. Approving
// one (via the generic update() below with a `status` value, same
// convention Application/Enrollment status changes already use) is what
// creates the resulting Student — see registration.controller.js.
const registrationsApi = {
  ...base,
  // The entire "Visitor API" — logs that a registration was opened for
  // review. Called automatically by RegistrationDetailDrawer the moment it
  // opens (the EXISTING Review click), never from a dedicated Visitor
  // button/page — there isn't one.
  logVisit: (id) => axiosInstance.post(`/registrations/${id}/visit`).then((res) => res.data.data),
};

export default registrationsApi;
