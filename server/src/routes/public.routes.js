const express = require('express');
const { getPublicCourses, getPublicCourse, registerAndEnroll } = require('../controllers/public.controller');
const upload = require('../middleware/upload.middleware');

// Intentionally the only route file in this project with no `protect`
// middleware — this is the public "discover a course -> register -> apply"
// entry point for visitors who have no account yet. Every other route file
// stays exactly as it was (SUPER_ADMIN/ADMIN/TRAINER/STUDENT all still
// require auth); nothing here overlaps with or bypasses those.
const router = express.Router();

router.get('/courses', getPublicCourses);
router.get('/courses/:id', getPublicCourse);
// Same image-only, 2MB multer instance every other profile-picture upload
// in the app already uses (student.routes.js, studentPortal.routes.js) —
// no second upload system.
router.post('/register', upload.single('profilePicture'), registerAndEnroll);

module.exports = router;
