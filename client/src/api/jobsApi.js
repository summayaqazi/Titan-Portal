import createCrudApi from './createCrudApi';

// Super Admin + Admin job management (Job Portal Phase 5). Plain JSON CRUD
// — no file uploads involved for a job posting — so the generic factory
// every other simple resource (courses, batches, ...) already uses is a
// full fit; no page-specific wrapper needed.
export default createCrudApi('jobs');
