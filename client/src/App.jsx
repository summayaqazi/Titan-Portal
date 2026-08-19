import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import { ROLES } from './constants/roles';

// Login/NotFound/Unauthorized stay eagerly imported — they (or a route
// nobody is authorized for) are the very first thing an unauthenticated or
// misdirected visitor sees, so there's no benefit to deferring them, and
// keeping them eager means the initial bundle still renders instantly with
// zero extra network round-trips for the most common entry point.
import Login from './pages/auth/Login';
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

// Everything below is route-level code-split via React.lazy: each page
// (and everything it alone imports — e.g. the face-api.js/react-quill/
// recharts/qrcode libraries some of these pull in) now lands in its own
// chunk that's only fetched when a user actually navigates to that portal/
// page, instead of every portal's entire page set being bundled into the
// one initial JS payload regardless of the visitor's role. Route paths,
// element props, and every RoleRoute/module gate below are unchanged —
// this only changes *when* each component's code is downloaded, not what
// renders or which permissions apply.
const SuperAdminLayout = lazy(() => import('./components/layout/SuperAdminLayout'));
const Dashboard = lazy(() => import('./pages/superadmin/Dashboard'));
const Students = lazy(() => import('./pages/superadmin/Students'));
const Registrations = lazy(() => import('./pages/superadmin/Registrations'));
const Courses = lazy(() => import('./pages/superadmin/Courses'));
const Batches = lazy(() => import('./pages/superadmin/Batches'));
const Campuses = lazy(() => import('./pages/superadmin/Campuses'));
const Cities = lazy(() => import('./pages/superadmin/Cities'));
const Slots = lazy(() => import('./pages/superadmin/Slots'));
const Trainers = lazy(() => import('./pages/superadmin/Trainers'));
const Attendance = lazy(() => import('./pages/superadmin/Attendance'));
const Payments = lazy(() => import('./pages/superadmin/Payments'));
const AdminUsers = lazy(() => import('./pages/superadmin/AdminUsers'));
const RolesPermissions = lazy(() => import('./pages/superadmin/RolesPermissions'));
const Profile = lazy(() => import('./pages/superadmin/Profile'));
const Jobs = lazy(() => import('./pages/superadmin/Jobs'));
const Applications = lazy(() => import('./pages/superadmin/Applications'));

const MarkAttendance = lazy(() => import('./pages/admin/MarkAttendance'));
const ViewAttendance = lazy(() => import('./pages/admin/ViewAttendance'));
const MultiAttendance = lazy(() => import('./pages/admin/MultiAttendance'));
const TrainerMarkAttendance = lazy(() => import('./pages/admin/TrainerMarkAttendance'));
const TrainerViewAttendance = lazy(() => import('./pages/admin/TrainerViewAttendance'));
const TrainerAttendanceRequests = lazy(() => import('./pages/admin/TrainerAttendanceRequests'));

const TrainerDashboard = lazy(() => import('./pages/trainer/Dashboard'));
const TrainerCalendar = lazy(() => import('./pages/trainer/Calendar'));
const TrainerAttendanceTab = lazy(() => import('./pages/trainer/Attendance'));
// Renamed on import (not `TrainerMarkAttendance`) to avoid colliding with
// the existing Admin-portal page of that exact name imported above — that
// page (Admin's manual mark/override) is untouched by this feature.
const TrainerMarkAttendancePage = lazy(() => import('./pages/trainer/MarkAttendance'));
const TrainerProfile = lazy(() => import('./pages/trainer/Profile'));
const TrainerCourseWorkspace = lazy(() => import('./pages/trainer/CourseWorkspace'));

const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentProgress = lazy(() => import('./pages/student/Progress'));
const StudentAttendance = lazy(() => import('./pages/student/Attendance'));
const StudentPayments = lazy(() => import('./pages/student/Payments'));
const StudentAssignments = lazy(() => import('./pages/student/Assignments'));
const StudentCourseDetails = lazy(() => import('./pages/student/CourseDetails'));
const StudentProfile = lazy(() => import('./pages/student/Profile'));
const StudentQuiz = lazy(() => import('./pages/student/Quiz'));
const StudentTakeQuiz = lazy(() => import('./pages/student/TakeQuiz'));

const PublicCourses = lazy(() => import('./pages/public/Courses'));
const PublicCourseDetails = lazy(() => import('./pages/public/CourseDetails'));
const PublicRegister = lazy(() => import('./pages/public/Register'));
const PublicRegisterSuccess = lazy(() => import('./pages/public/RegisterSuccess'));

const PublicJobs = lazy(() => import('./pages/public/Jobs'));
const PublicJobDetails = lazy(() => import('./pages/public/JobDetails'));
const PublicJobApply = lazy(() => import('./pages/public/JobApply'));
const PublicApplicationSuccess = lazy(() => import('./pages/public/ApplicationSuccess'));

const ApplicantDashboard = lazy(() => import('./pages/applicant/Dashboard'));
const ApplicantApplications = lazy(() => import('./pages/applicant/Applications'));
const ApplicantApplicationDetails = lazy(() => import('./pages/applicant/ApplicationDetails'));
const ApplicantProfile = lazy(() => import('./pages/applicant/Profile'));

// Each Super Admin / Admin page sits behind its own RoleRoute with a
// `module` key so permission edits made on the Roles & Permissions page are
// enforced route by route (SUPER_ADMIN's permissions are always all-true, so
// this doesn't change anything for that role).
function moduleRoute(module, path, element, roles = [ROLES.SUPER_ADMIN]) {
  return (
    <Route key={`${roles.join('-')}-${path}`} element={<RoleRoute allowedRoles={roles} module={module} />}>
      <Route path={path} element={element} />
    </Route>
  );
}

// Same page components, same permission-module gate, mounted under /admin
// instead of /super-admin for the ADMIN role. No page is duplicated — this
// just registers a second set of routes pointing at the same components.
function adminModuleRoute(module, path, element) {
  return moduleRoute(module, path, element, [ROLES.ADMIN]);
}

// Same pattern again for the Trainer portal.
function trainerModuleRoute(module, path, element) {
  return moduleRoute(module, path, element, [ROLES.TRAINER]);
}

// Same pattern again for the Student portal.
function studentModuleRoute(module, path, element) {
  return moduleRoute(module, path, element, [ROLES.STUDENT]);
}

// Same pattern again for the Applicant Portal (Job Portal Phase 4).
function applicantModuleRoute(module, path, element) {
  return moduleRoute(module, path, element, [ROLES.APPLICANT]);
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* fallback={null}: matches ProtectedRoute's own existing
            loading-state convention (also `return null` while it waits on
            /auth/me) — a lazy chunk fetch on a warm connection resolves in a
            handful of milliseconds, so rendering nothing briefly avoids a
            spinner flash without hiding genuinely slow states (those still
            show each page's own existing loading UI once it mounts). */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Public course discovery + registration flow — unauthenticated
                on purpose, sits outside ProtectedRoute below. A brand-new
                visitor with no account yet: Courses -> Course Details ->
                Enroll Now -> Register -> pending Registration (no User/
                Student exists yet) -> Super Admin/Admin review in the
                Registrations module -> approval creates the Student -> the
                Student Portal login they set a password for now works.
                Nothing under ProtectedRoute is touched by these routes. */}
            <Route path="/courses" element={<PublicCourses />} />
            <Route path="/courses/:courseId" element={<PublicCourseDetails />} />
            <Route path="/register" element={<PublicRegister />} />
            <Route path="/enroll/:courseId" element={<PublicRegister />} />
            <Route path="/register/success" element={<PublicRegisterSuccess />} />

            {/* Public Job Portal — Phase 2 (listing + details) + Phase 3
                (Apply Now -> Applicant login/registration + Application Form
                -> success). All still unauthenticated-entry, additive sibling
                routes — nothing above/below this block is touched. No
                Applicant Dashboard route yet (a later phase) — JobApply.jsx
                and ApplicationSuccess.jsx handle auth inline via AuthContext,
                they don't need a protected route of their own. */}
            <Route path="/jobs" element={<PublicJobs />} />
            <Route path="/jobs/:id" element={<PublicJobDetails />} />
            <Route path="/jobs/:id/apply" element={<PublicJobApply />} />
            <Route path="/apply/success" element={<PublicApplicationSuccess />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<RoleRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
                <Route path="/super-admin" element={<SuperAdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  {moduleRoute('dashboard', 'dashboard', <Dashboard />)}
                  {moduleRoute('students', 'students', <Students />)}
                  {/* Deliberately its own route/component/module — a
                      Registration is reviewed before any Student exists, see
                      Registration.js's header comment. Never reuses Students
                      or its route. */}
                  {moduleRoute('registrations', 'registrations', <Registrations />)}
                  {moduleRoute('courses', 'courses', <Courses />)}
                  {moduleRoute('batches', 'batches', <Batches />)}
                  {moduleRoute('campuses', 'campuses', <Campuses />)}
                  {moduleRoute('cities', 'cities', <Cities />)}
                  {moduleRoute('slots', 'slots', <Slots />)}
                  {moduleRoute('trainers', 'trainers', <Trainers />)}
                  {moduleRoute('attendance', 'attendance', <Attendance />)}
                  {moduleRoute('payments', 'payments', <Payments />)}
                  {/* Job Portal Phase 5 */}
                  {moduleRoute('jobs', 'jobs', <Jobs />)}
                  {moduleRoute('applications', 'applications', <Applications />)}
                  {moduleRoute('adminUsers', 'admin-users', <AdminUsers />)}
                  {moduleRoute('rolesPermissions', 'roles-permissions', <RolesPermissions />)}
                  {moduleRoute('profile', 'profile', <Profile />)}
                </Route>
              </Route>

              <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
                <Route path="/admin" element={<SuperAdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  {adminModuleRoute('dashboard', 'dashboard', <Dashboard />)}
                  {adminModuleRoute('students', 'students', <Students />)}
                  {/* Same 'registrations' permission as Super Admin — unset
                      (false) for Admin by default in seed.js, so RoleRoute's
                      own can(module,'view') check keeps this page
                      unreachable until a Super Admin explicitly grants it on
                      the Roles & Permissions page. Registered here
                      regardless, same convention as every other
                      Admin-reachable module route. */}
                  {adminModuleRoute('registrations', 'registrations', <Registrations />)}
                  {adminModuleRoute('attendance', 'attendance/mark', <MarkAttendance />)}
                  {adminModuleRoute('attendance', 'attendance/view', <ViewAttendance />)}
                  {adminModuleRoute('attendance', 'attendance/multi', <MultiAttendance />)}
                  {adminModuleRoute('slots', 'slots', <Slots />)}
                  {adminModuleRoute('trainers', 'trainers', <Trainers />)}
                  {/* Job Portal Phase 5 — same Jobs.jsx component as Super
                      Admin; create/edit/publish/close/delete are restricted
                      server-side to the jobs this Admin created (see
                      job.controller.js's canManageJob). No Applications
                      route for Admin — that stays Super-Admin-only. */}
                  {adminModuleRoute('jobs', 'jobs', <Jobs />)}
                  {adminModuleRoute('attendance', 'trainer-attendance/mark', <TrainerMarkAttendance />)}
                  {adminModuleRoute('attendance', 'trainer-attendance/view', <TrainerViewAttendance />)}
                  {adminModuleRoute('attendance', 'trainer-attendance/requests', <TrainerAttendanceRequests />)}
                  {/* Updation is intentionally not registered for ADMIN — sidebar entry,
                      route, and permission grant were all removed on purpose; the module
                      itself (page, API, backend route) is untouched for future/other use. */}
                  {/* Not in the Admin sidebar — reachable via the "Generate Payment" link
                      from a student's Payments summary in the (shared) Student Detail Drawer. */}
                  {adminModuleRoute('payments', 'payments', <Payments />)}
                  {adminModuleRoute('profile', 'profile', <Profile />)}
                </Route>
              </Route>

              {/* Trainer Portal — reuses SuperAdminLayout exactly like Admin
                  does (Sidebar/Header branch on user.role internally, no new
                  layout component needed). Phase 2: Dashboard, Calendar and
                  Profile are real; Attendance stays a Phase-3+ placeholder. */}
              <Route element={<RoleRoute allowedRoles={[ROLES.TRAINER]} />}>
                <Route path="/trainer" element={<SuperAdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  {trainerModuleRoute('dashboard', 'dashboard', <TrainerDashboard />)}
                  {trainerModuleRoute('dashboard', 'calendar', <TrainerCalendar />)}
                  {trainerModuleRoute('dashboard', 'courses/:batchId', <TrainerCourseWorkspace />)}
                  {trainerModuleRoute('attendance', 'attendance', <TrainerAttendanceTab />)}
                  {trainerModuleRoute('attendance', 'attendance/mark', <TrainerMarkAttendancePage />)}
                  {trainerModuleRoute('profile', 'profile', <TrainerProfile />)}
                </Route>
              </Route>

              {/* Student Portal — reuses SuperAdminLayout exactly like Admin
                  and Trainer do (Sidebar/Header branch on user.role
                  internally, no new layout component needed). Phase 1
                  (Dashboard), Phase 2 (Assignments), Phase 3 (Progress,
                  Attendance), Phase 4 (Payments), Phase 5 (Quiz + take-quiz,
                  server-graded attempts), Phase 6 (Course Details —
                  courses/:enrollmentId, gated on the 'dashboard' module like
                  Trainer's own courses/:batchId Course Workspace route
                  above), and Phase 7 (Profile + Edit Profile) each follow
                  the exact same incremental approach the Trainer Portal
                  used. */}
              <Route element={<RoleRoute allowedRoles={[ROLES.STUDENT]} />}>
                <Route path="/student" element={<SuperAdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  {studentModuleRoute('dashboard', 'dashboard', <StudentDashboard />)}
                  {studentModuleRoute('dashboard', 'courses/:enrollmentId', <StudentCourseDetails />)}
                  {studentModuleRoute('progress', 'progress', <StudentProgress />)}
                  {studentModuleRoute('attendance', 'attendance', <StudentAttendance />)}
                  {studentModuleRoute('payments', 'payments', <StudentPayments />)}
                  {studentModuleRoute('assignments', 'assignments', <StudentAssignments />)}
                  {studentModuleRoute('quizzes', 'quizzes', <StudentQuiz />)}
                  {studentModuleRoute('quizzes', 'quizzes/:quizId/take', <StudentTakeQuiz />)}
                  {studentModuleRoute('profile', 'profile', <StudentProfile />)}
                </Route>
              </Route>

              {/* Applicant Portal (Job Portal Phase 4) — reuses SuperAdminLayout
                  exactly like Trainer/Student do. Read-only application
                  tracking only: Dashboard, My Applications, Application
                  Details, Profile. No job-management or application-review
                  functionality here — that's a Super Admin concern, a later
                  phase. */}
              <Route element={<RoleRoute allowedRoles={[ROLES.APPLICANT]} />}>
                <Route path="/applicant" element={<SuperAdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  {applicantModuleRoute('applications', 'dashboard', <ApplicantDashboard />)}
                  {applicantModuleRoute('applications', 'applications', <ApplicantApplications />)}
                  {applicantModuleRoute('applications', 'applications/:id', <ApplicantApplicationDetails />)}
                  {applicantModuleRoute('profile', 'profile', <ApplicantProfile />)}
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
