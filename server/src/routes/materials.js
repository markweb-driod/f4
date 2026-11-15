const express = require('express');
const db = require('../config/db');
const { authorize, denyOwnership } = require('../middleware/authorize');
const { canViewCourse, canManageCourse, courseExists } = require('../services/ownership');
const { singleFile, fileColumns, removeFile, discardUpload, sendStored } = require('../services/upload');
const { asyncHandler, HttpError, toId, requireString, optionalString } = require('../utils/http');

const router = express.Router();

// Metadata only; the file bytes (fileData) are read just for downloads.
async function getMaterial(id) {
  const [[m]] = await db.execute(
    `SELECT materialID, courseID, title, description, filePath, originalName, mimeType, fileSize,
            (fileData IS NOT NULL) AS hasData
       FROM tbl_materials WHERE materialID = ?`, [id]);
  if (!m) throw new HttpError(404, 'Material not found');
  return m;
}

router.get('/courses/:courseId/materials', authorize('/api/v1/materials', 'READ'), asyncHandler(async (req, res) => {
  const courseID = toId(req.params.courseId);
  if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
  if (!(await canViewCourse(req.user, courseID))) return denyOwnership(req, res, 'READ', `course ${courseID}`);
  const [rows] = await db.execute(
    `SELECT m.materialID AS id, m.title, m.description, m.originalName, m.fileSize, m.createdAt, u.fullName AS uploadedBy
       FROM tbl_materials m LEFT JOIN tbl_users u ON u.userID = m.uploadedBy
      WHERE m.courseID = ? ORDER BY m.createdAt DESC, m.materialID DESC`, [courseID]);
  res.json(rows);
}));

router.post('/courses/:courseId/materials', authorize('/api/v1/materials', 'CREATE'), singleFile('file'), asyncHandler(async (req, res) => {
  const courseID = toId(req.params.courseId);
  try {
    if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
    if (!(await canManageCourse(req.user, courseID))) {
      discardUpload(req.file);
      return denyOwnership(req, res, 'CREATE', `course ${courseID} not assigned`);
    }
    const title = requireString(req.body.title, 'Title', { max: 150 });
    const description = optionalString(req.body.description, 'Description');
    if (!req.file && !description) throw new HttpError(400, 'Attach a file or enter some content');
    const f = fileColumns(req.file);
    const [r] = await db.execute(
      `INSERT INTO tbl_materials (courseID, title, description, filePath, fileData, originalName, mimeType, fileSize, uploadedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [courseID, title, description, f.filePath, f.fileData, f.originalName, f.mimeType, f.fileSize, req.user.id]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    discardUpload(req.file);
    throw e;
  }
}));

router.put('/materials/:id', authorize('/api/v1/materials', 'UPDATE'), asyncHandler(async (req, res) => {
  const m = await getMaterial(toId(req.params.id));
  if (!(await canManageCourse(req.user, m.courseID))) return denyOwnership(req, res, 'UPDATE', `material ${m.materialID}`);
  const b = req.body || {};
  const title = b.title !== undefined ? requireString(b.title, 'Title', { max: 150 }) : m.title;
  const description = b.description !== undefined ? optionalString(b.description, 'Description') : m.description;
  await db.execute('UPDATE tbl_materials SET title = ?, description = ? WHERE materialID = ?', [title, description, m.materialID]);
  res.json({ ok: true });
}));

router.delete('/materials/:id', authorize('/api/v1/materials', 'DELETE'), asyncHandler(async (req, res) => {
  const m = await getMaterial(toId(req.params.id));
  if (!(await canManageCourse(req.user, m.courseID))) return denyOwnership(req, res, 'DELETE', `material ${m.materialID}`);
  await db.execute('DELETE FROM tbl_materials WHERE materialID = ?', [m.materialID]);
  removeFile(m.filePath);
  res.json({ ok: true });
}));

router.get('/materials/:id/download', authorize('/api/v1/materials', 'READ'), asyncHandler(async (req, res) => {
  const m = await getMaterial(toId(req.params.id));
  if (!(await canViewCourse(req.user, m.courseID))) return denyOwnership(req, res, 'READ', `material ${m.materialID}`);
  if (!m.filePath && !Number(m.hasData)) throw new HttpError(404, 'This material has no attached file');
  const [[file]] = await db.execute('SELECT filePath, fileData, originalName, mimeType FROM tbl_materials WHERE materialID = ?', [m.materialID]);
  sendStored(res, file);
}));

module.exports = router;
