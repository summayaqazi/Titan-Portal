const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Strips anything that isn't safe in a filename/URL segment, so the
// original name can be embedded directly in the stored filename below
// without a path-traversal or header-injection risk.
const sanitizeFilename = (name) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 80);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  // The unique prefix is still what guarantees no collisions; appending the
  // sanitized original name (not just the extension) means a later
  // "download" can recover a readable filename from the stored path alone
  // — no separate "original name" column needed, and every existing upload
  // site (avatars, payment proofs, assignments, ...) gets this for free.
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const base = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${uniqueSuffix}-${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (isValid) {
    cb(null, true);
  } else {
    const error = new Error('Only image files (jpeg, jpg, png, webp) are allowed');
    error.statusCode = 400;
    cb(error);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// Broader instance for Assignment reference images + attachments — shares
// the same disk storage, but also accepts common document types (not just
// images). Only used by the assignment routes; every other upload site
// keeps using the images-only `upload` above, untouched.
const documentFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf|docx?|zip/;
  const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (isValid) {
    cb(null, true);
  } else {
    const error = new Error('Only image, PDF, Word or zip files are allowed');
    error.statusCode = 400;
    cb(error);
  }
};

const uploadDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Job Portal — applicant resumes/CVs. Deliberately a SEPARATE disk
// destination from `storage` above: `storage` writes into src/uploads/,
// which app.js serves publicly via `express.static('/uploads')`. A resume
// must never be reachable through a public URL, so it's written to
// src/private-uploads/resumes/ instead — a directory app.js never mounts
// with express.static, and is only ever read back through a permission-
// gated download endpoint added in a later phase. Still the same multer
// package/pattern as every other upload site in this file (unique-prefixed,
// sanitized filename) — not a second upload system, just a second
// destination.
const privateUploadsDir = path.join(__dirname, '..', 'private-uploads', 'resumes');
// multer's diskStorage does not create its destination directory itself —
// ensured once here so a fresh clone / first run doesn't fail on the first
// resume upload.
fs.mkdirSync(privateUploadsDir, { recursive: true });

const privateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, privateUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const base = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${uniqueSuffix}-${base}${ext}`);
  },
});

const resumeFileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|docx?/;
  const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (isValid) {
    cb(null, true);
  } else {
    const error = new Error('Only PDF, DOC or DOCX files are allowed for a resume/CV');
    error.statusCode = 400;
    cb(error);
  }
};

const uploadResume = multer({
  storage: privateStorage,
  fileFilter: resumeFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — same limit as uploadDocument above
});

// Job Portal — job application submission. Accepts BOTH the applicant's
// own photo (required, image-only, public /uploads/ — same convention as
// every other profile-picture upload in this app) and an optional resume/
// CV (private-uploads/resumes/, pdf/doc only, never public) in the SAME
// multipart request. A single multer instance whose destination/fileFilter
// branch on `file.fieldname`, since `upload`/`uploadResume` above each only
// handle one file type/destination — this is the one upload site in the
// app that genuinely needs both at once. Deliberately a separate instance
// from both, not a change to either: every other caller of `upload`/
// `uploadResume` is completely unaffected.
const applicationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'resume') return cb(null, privateUploadsDir);
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const base = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${uniqueSuffix}-${base}${ext}`);
  },
});

const applicationFileFilter = (req, file, cb) => {
  if (file.fieldname === 'resume') return resumeFileFilter(req, file, cb);
  return fileFilter(req, file, cb);
};

const uploadApplicationFiles = multer({
  storage: applicationStorage,
  fileFilter: applicationFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // covers the resume; the photo is still effectively capped by fileFilter's image-type check
});

module.exports = upload;
module.exports.uploadApplicationFiles = uploadApplicationFiles;
module.exports.uploadDocument = uploadDocument;
module.exports.uploadResume = uploadResume;
