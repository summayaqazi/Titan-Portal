const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // matches the backend's multer limit

// Mirrors the server's upload.middleware validation so users get instant
// feedback instead of waiting on a round-trip 400.
export const validateImageFile = (file) => {
  if (!file) return null;
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPG, PNG or WEBP images are allowed';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Image must be 2MB or smaller';
  }
  return null;
};

const RESUME_ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
const RESUME_MAX_SIZE_BYTES = 5 * 1024 * 1024; // matches the backend's uploadResume limit

// Mirrors the server's upload.middleware.js resumeFileFilter — extension-
// based (not file.type) since that's what the backend checks too, and a
// browser's reported MIME type for .doc/.docx is inconsistent across OSes.
export const validateResumeFile = (file) => {
  if (!file) return null;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!RESUME_ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Only PDF, DOC or DOCX files are allowed';
  }
  if (file.size > RESUME_MAX_SIZE_BYTES) {
    return 'Resume must be 5MB or smaller';
  }
  return null;
};
