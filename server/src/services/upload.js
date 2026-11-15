// File uploads for course materials and assignment submissions.
// Files are stored outside any public folder under random names and are only served
// through authorised download routes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { HttpError } = require('../utils/http');

const ALLOWED = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.csv', '.zip', '.png', '.jpg', '.jpeg']);
const MAX_BYTES = 10 * 1024 * 1024;

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadDir),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) return cb(new HttpError(400, `File type ${ext || '(none)'} is not allowed`));
    cb(null, true);
  },
});

// Wraps multer so its errors become clean 400 responses.
function singleFile(field) {
  const handler = upload.single(field);
  return (req, res, next) => handler(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return next(new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB' : err.message));
    }
    next(err);
  });
}

function removeFile(storedName) {
  if (!storedName) return;
  const full = path.join(env.uploadDir, path.basename(storedName));
  fs.promises.unlink(full).catch(() => {});
}

function sendStored(res, storedName, originalName, mimeType) {
  const full = path.join(env.uploadDir, path.basename(storedName));
  if (!fs.existsSync(full)) throw new HttpError(404, 'File not found');
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(full, originalName || path.basename(storedName));
}

module.exports = { singleFile, removeFile, sendStored, ALLOWED: [...ALLOWED] };
