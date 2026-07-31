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
