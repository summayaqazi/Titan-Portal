const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
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

module.exports = upload;
module.exports.uploadDocument = uploadDocument;
