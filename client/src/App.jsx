import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import { ROLES } from './constants/roles';

import Login from './pages/auth/Login';
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

import SuperAdminLayout from './components/layout/SuperAdminLayout';
import Dashboard from './pages/superadmin/Dashboard';
import Students from './pages/superadmin/Students';
import Courses from './pages/superadmin/Courses';
import Batches from './pages/superadmin/Batches';
import Campuses from './pages/superadmin/Campuses';
import Cities from './pages/superadmin/Cities';
import Slots from './pages/superadmin/Slots';
import Trainers from './pages/superadmin/Trainers';
import Attendance from './pages/superadmin/Attendance';
import Payments from './pages/superadmin/Payments';
import AdminUsers from './pages/superadmin/AdminUsers';
import RolesPermissions from './pages/superadmin/RolesPermissions';
import Profile from './pages/superadmin/Profile';
import Jobs from './pages/superadmin/Jobs';
import Applications from './pages/superadmin/Applications';

import MarkAttendance from './pages/admin/MarkAttendance';
import ViewAttendance from './pages/admin/ViewAttendance';
import MultiAttendance from './pages/admin/MultiAttendance';
import TrainerMarkAttendance from './pages/admin/TrainerMarkAttendance';
import TrainerViewAttendance from './pages/admin/TrainerViewAttendance';
import TrainerAttendanceRequests from './pages/admin/TrainerAttendanceRequests';

import TrainerDashboard from './pages/trainer/Dashboard';
import TrainerCalendar from './pages/trainer/Calendar';
import TrainerAttendanceTab from './pages/trainer/Attendance';
import TrainerProfile from './pages/trainer/Profile';
import TrainerCourseWorkspace from './pages/trainer/CourseWorkspace';

import StudentDashboard from './pages/student/Dashboard';
import StudentProgress from './pages/student/Progress';
import StudentAttendance from './pages/student/Attendance';
import StudentPayments from './pages/student/Payments';
import StudentAssignments from './pages/student/Assignments';
import StudentCourseDetails from './pages/student/CourseDetails';
import StudentProfile from './pages/student/Profile';
import StudentQuiz from './pages/student/Quiz';
import StudentTakeQuiz from './pages/student/TakeQuiz';

import PublicCourses from './pages/public/Courses';
import PublicCourseDetails from './pages/public/CourseDetails';
import PublicRegister from './pages/public/Register';
import PublicRegisterSuccess from './pages/public/RegisterSuccess';

import PublicJobs from './pages/public/Jobs';
import PublicJobDetails from './pages/public/JobDetails';
import PublicJobApply from './pages/public/JobApply';
import PublicApplicationSuccess from './pages/public/ApplicationSuccess';

import ApplicantDashboard from './pages/applicant/Dashboard';
import ApplicantApplications from './pages/applicant/Applications';
import ApplicantApplicationDetails from './pages/applicant/ApplicationDetails';
import ApplicantProfile from './pages/applicant/Profile';

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
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Public course discovery + registration/enrollment flow —
              unauthenticated on purpose, sits outside ProtectedRoute below.
              A brand-new visitor with no account yet: Courses -> Course
              Details -> Enroll Now -> Register -> pending Enrollment ->
              existing Admin/Super Admin approval workflow -> existing
              Student Portal login. Nothing under ProtectedRoute is touched
              by these routes. */}
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
      </AuthProvider>
    </BrowserRouter>
  );
}
