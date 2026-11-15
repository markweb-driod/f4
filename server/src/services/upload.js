// File uploads for course materials and assignment submissions.
//
// Two storage modes (FILE_STORAGE):
//   disk      files go to the uploads folder under random names (local / XAMPP installs)
//   database  file bytes go into a MEDIUMBLOB column (Vercel and other read-only hosts)
// Either way, files are never publicly reachable: they are served only through the
// authorised download routes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { HttpError } = require('../utils/http');

const ALLOWED = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.csv', '.zip', '.png', '.jpg', '.jpeg']);
const MAX_BYTES = Math.floor(env.maxUploadMb * 1024 * 1024);
const toDisk = env.fileStorage === 'disk';

if (toDisk) fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = toDisk
  ? multer.diskStorage({
    destination: (req, file, cb) => cb(null, env.uploadDir),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
  })
  : multer.memoryStorage();

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
      return next(new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? `File is larger than ${env.maxUploadMb} MB` : err.message));
    }
    next(err);
  });
}

// Column values to store for an uploaded file (or all nulls when there is none).
function fileColumns(file) {
  if (!file) return { filePath: null, fileData: null, originalName: null, mimeType: null, fileSize: null };
  return {
    filePath: toDisk ? file.filename : null,
    fileData: toDisk ? null : file.buffer,
    originalName: file.originalname.slice(0, 255),
    mimeType: file.mimetype,
    fileSize: file.size,
  };
}

// Remove a file kept on disk (no-op for database-stored files).
function removeFile(storedName) {
  if (!storedName) return;
  const full = path.join(env.uploadDir, path.basename(storedName));
  fs.promises.unlink(full).catch(() => {});
}

// Throw away an upload whose request was rejected.
function discardUpload(file) {
  if (file && file.filename) removeFile(file.filename);
}

const hasFile = (row) => !!(row && (row.filePath || row.hasData));

// Send a stored file. `row` needs filePath, originalName, mimeType and, for database
// storage, fileData.
function sendStored(res, row) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const name = row.originalName || 'download';
  if (row.fileData) {
    res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
    res.attachment(name);
    return res.send(row.fileData);
  }
  if (!row.filePath) throw new HttpError(404, 'File not found');
  const full = path.join(env.uploadDir, path.basename(row.filePath));
  if (!fs.existsSync(full)) throw new HttpError(404, 'File not found');
  res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
  return res.download(full, name);
}

module.exports = { singleFile, fileColumns, removeFile, discardUpload, sendStored, hasFile, ALLOWED: [...ALLOWED] };
