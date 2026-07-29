# Titan Institute Portal

A full-stack IT Institute Management Portal (FYP project). This repository currently
contains the **Super Admin Portal** foundation: authentication, role-based routing,
the Super Admin layout/navigation, and the core Mongoose data models.

## Tech Stack

**Frontend:** React, Vite, JavaScript, Tailwind CSS, React Router, Axios, Recharts, lucide-react

**Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT auth, bcrypt, Multer

## Project Structure

```
/client   React + Vite frontend
/server   Express + MongoDB backend
```

### Server structure

```
server/
  src/
    config/db.js              MongoDB connection
    models/                   Mongoose models (User, Student, Trainer, Course,
                               Batch, Campus, City, Slot, Enrollment,
                               Attendance, Payment)
    controllers/auth.controller.js
    routes/                   auth.routes.js, index.js
    middleware/                auth.middleware.js (protect/authorize),
                               error.middleware.js, upload.middleware.js (Multer)
    utils/                    generateToken.js, constants.js, seed.js
    app.js                    Express app (middleware + route mounting)
    server.js                 Entry point (connects DB, starts server)
  uploads/                    Local storage for uploaded files (Multer)
  .env.example
```

### Client structure

```
client/
  src/
    api/                      axiosInstance.js, authApi.js
    components/
      common/                Button, Input, Select, Textarea, FormField,
                              Table, Modal, Drawer, StatusBadge,
                              PageContainer, ComingSoon
      layout/                Sidebar, Header, SuperAdminLayout
    context/AuthContext.jsx   Auth state (login/logout/current user)
    routes/                  ProtectedRoute.jsx, RoleRoute.jsx
    constants/               roles.js, navigation.js
    pages/
      auth/Login.jsx
      superadmin/            Dashboard, Students, Courses, Batches, Campuses,
                              Cities, Slots, Trainers, Attendance, Payments,
                              AdminUsers, RolesPermissions, Profile
      NotFound.jsx, Unauthorized.jsx
    App.jsx                  Route definitions
    main.jsx                 App entry point
  .env.example
```

## Domain Model Notes

A student's course participation is **not** stored as a single field on the
Student model. Instead, a separate `Enrollment` model links `Student`, `Course`,
`Batch`, `Campus`, `Trainer`, and `Slot`, and carries the roll number, enrollment
status, payment status, admission date, and a status-change history. This allows
a student to have multiple enrollments over time (e.g. re-enrolling in a
different course, or being enrolled in more than one course at once).

Enrollment statuses: `pending`, `approved`, `rejected`, `passed`, `failed`,
`enrolled`, `completed`, `eliminated`, `dropout`, `cancelled`, `certified`,
`blacklisted`.

## Prerequisites

- Node.js 18+
- A running MongoDB instance (local or Atlas)

## Setup

### 1. Server

```bash
cd server
npm install
cp .env.example .env   # then edit .env with your own values
npm run seed            # creates an initial SUPER_ADMIN user
npm run dev              # starts the API on http://localhost:5000
```

The seed script creates a Super Admin using `SEED_SUPER_ADMIN_EMAIL` /
`SEED_SUPER_ADMIN_PASSWORD` from `.env` (defaults:
`superadmin@titan.com` / `SuperAdmin123`).

### 2. Client

```bash
cd client
npm install
cp .env.example .env   # adjust VITE_API_URL if your API runs elsewhere
npm run dev              # starts the app on http://localhost:5173
```

Log in at `http://localhost:5173/login` with the seeded Super Admin credentials.

## Available Routes (Frontend)

| Path                                    | Description                         |
|------------------------------------------|--------------------------------------|
| `/login`                                 | Login page                          |
| `/super-admin/dashboard`                 | Dashboard (placeholder)             |
| `/super-admin/students`                  | Students (placeholder)              |
| `/super-admin/courses`                   | Courses (placeholder)               |
| `/super-admin/batches`                   | Batches (placeholder)               |
| `/super-admin/campuses`                  | Campuses (placeholder)              |
| `/super-admin/cities`                    | Cities (placeholder)                |
| `/super-admin/slots`                     | Slots (placeholder)                 |
| `/super-admin/trainers`                  | Trainers (placeholder)              |
| `/super-admin/attendance`                | Attendance (placeholder)            |
| `/super-admin/payments`                  | Payments (placeholder)              |
| `/super-admin/admin-users`               | Admin Users (placeholder)           |
| `/super-admin/roles-permissions`         | Roles & Permissions (placeholder)   |
| `/super-admin/profile`                   | Profile (placeholder)               |

All `/super-admin/*` routes are protected and restricted to the `SUPER_ADMIN` role.

## Available Endpoints (Backend)

| Method | Path              | Description                    | Access        |
|--------|-------------------|---------------------------------|---------------|
| GET    | `/api/health`     | Health check                    | Public        |
| POST   | `/api/auth/login` | Log in, returns JWT + user      | Public        |
| GET    | `/api/auth/me`    | Get current authenticated user  | Authenticated |

## Notes

- Windows only: if your project path contains an `&` (as this one does — "WEBS & APPS"),
  npm's generated `.cmd` shims for binaries like `nodemon` can fail to resolve their
  path correctly. The `server` package.json's `dev` script works around this by
  invoking `node node_modules/nodemon/bin/nodemon.js` directly instead of the
  `nodemon` shim. Keep this in mind if you add other CLI dev-dependencies later.
- This is an early-stage FYP scaffold. Student, Attendance, Trainer, Payment, and
  Dashboard functionality are intentionally left as placeholders for future tasks.
