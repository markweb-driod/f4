const express = require('express');
const db = require('../config/db');
const { authorize, denyOwnership } = require('../middleware/authorize');
const { canViewCourse, canManageCourse, courseExists } = require('../services/ownership');
const { asyncHandler, HttpError, toId, requireString, optionalString } = require('../utils/http');

const router = express.Router();

// List courses visible to the active role: Admin all, Lecturer assigned, Student enrolled.
router.get('/', authorize('/api/v1/courses', 'READ'), asyncHandler(async (req, res) => {
  const base = `SELECT c.courseID AS id, c.courseCode AS code, c.title, c.description, c.creditUnits,
      (SELECT GROUP_CONCAT(u.fullName ORDER BY u.fullName SEPARATOR ', ') FROM tbl_course_lecturers cl
         JOIN tbl_users u ON u.userID = cl.userID WHERE cl.courseID = c.courseID) AS lecturers,
      (SELECT COUNT(*) FROM tbl_enrollments e WHERE e.courseID = c.courseID) AS studentCount,
      (SELECT COUNT(*) FROM tbl_materials m WHERE m.courseID = c.courseID) AS materialCount,
      (SELECT COUNT(*) FROM tbl_assignments a WHERE a.courseID = c.courseID) AS assignmentCount
    FROM tbl_courses c`;
  let rows;
  if (req.user.role === 'Admin') {
    [rows] = await db.execute(`${base} ORDER BY c.courseCode`);
  } else if (req.user.role === 'Lecturer') {
    [rows] = await db.execute(`${base} JOIN tbl_course_lecturers x ON x.courseID = c.courseID AND x.userID = ? ORDER BY c.courseCode`, [req.user.id]);
  } else if (req.user.role === 'Student') {
    [rows] = await db.execute(`${base} JOIN tbl_enrollments x ON x.courseID = c.courseID AND x.userID = ? ORDER BY c.courseCode`, [req.user.id]);
  } else {
    rows = [];
  }
  res.json(rows.map((r) => ({ ...r, studentCount: Number(r.studentCount), materialCount: Number(r.materialCount), assignmentCount: Number(r.assignmentCount) })));
}));

router.get('/:id', authorize('/api/v1/courses', 'READ'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!(await courseExists(id))) throw new HttpError(404, 'Course not found');
  if (!(await canViewCourse(req.user, id))) return denyOwnership(req, res, 'READ', `course ${id} not assigned/enrolled`);
  const [[c]] = await db.execute(
    'SELECT courseID AS id, courseCode AS code, title, description, creditUnits FROM tbl_courses WHERE courseID = ?', [id]);
  const [lecturers] = await db.execute(
    `SELECT u.userID AS id, u.fullName AS name, u.username FROM tbl_course_lecturers cl
       JOIN tbl_users u ON u.userID = cl.userID WHERE cl.courseID = ? ORDER BY u.fullName`, [id]);
  c.lecturers = lecturers;
  // Only staff see the class list; students do not see other students.
  if (req.user.role !== 'Student') {
    const [students] = await db.execute(
      `SELECT u.userID AS id, u.fullName AS name, u.username, e.enrolledAt FROM tbl_enrollments e
         JOIN tbl_users u ON u.userID = e.userID WHERE e.courseID = ? ORDER BY u.fullName`, [id]);
    c.students = students;
  }
  c.canManage = await canManageCourse(req.user, id);
  res.json(c);
}));

router.post('/', authorize('/api/v1/courses', 'CREATE'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const code = requireString(b.code, 'Course code', { max: 20 }).toUpperCase();
  const title = requireString(b.title, 'Title', { max: 150 });
  const units = Number(b.creditUnits ?? 3);
  if (!Number.isInteger(units) || units < 1 || units > 12) throw new HttpError(400, 'Credit units must be 1-12');
  try {
    const [r] = await db.execute('INSERT INTO tbl_courses (courseCode, title, description, creditUnits) VALUES (?, ?, ?, ?)',
      [code, title, optionalString(b.description, 'Description'), units]);
    res.status(201).json({ id: r.insertId, code, title });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A course with that code already exists');
    throw e;
  }
}));

// Admin edits any course; a Lecturer edits only the description/title of assigned courses.
router.put('/:id', authorize('/api/v1/courses', 'UPDATE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!(await courseExists(id))) throw new HttpError(404, 'Course not found');
  if (req.user.role !== 'Admin' && !(await canManageCourse(req.user, id))) {
    return denyOwnership(req, res, 'UPDATE', `course ${id} not assigned`);
  }
  const b = req.body || {};
  const title = b.title !== undefined ? requireString(b.title, 'Title', { max: 150 }) : null;
  const description = b.description !== undefined ? optionalString(b.description, 'Description') : undefined;
  let code = null;
  let units = null;
  if (req.user.role === 'Admin') {
    if (b.code !== undefined) code = requireString(b.code, 'Course code', { max: 20 }).toUpperCase();
    if (b.creditUnits !== undefined) {
      units = Number(b.creditUnits);
      if (!Number.isInteger(units) || units < 1 || units > 12) throw new HttpError(400, 'Credit units must be 1-12');
    }
  }
  try {
    await db.execute(
      `UPDATE tbl_courses SET title = COALESCE(?, title), courseCode = COALESCE(?, courseCode),
              creditUnits = COALESCE(?, creditUnits), description = IF(?, ?, description) WHERE courseID = ?`,
      [title, code, units, description !== undefined ? 1 : 0, description ?? null, id]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A course with that code already exists');
    throw e;
  }
  res.json({ ok: true });
}));

router.delete('/:id', authorize('/api/v1/courses', 'DELETE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const [r] = await db.execute('DELETE FROM tbl_courses WHERE courseID = ?', [id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'Course not found');
  res.json({ ok: true });
}));

// ---- Membership: assigning lecturers and enrolling students (Admin) ----
// Inserts go through stored procedures that enforce Static Separation of Duty (ST-10).
const MEMBERS = ['/api/v1/courses/members', 'UPDATE'];

router.post('/:id/lecturers', authorize(...MEMBERS), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const userID = toId((req.body || {}).userId, 'user id');
  if (!(await courseExists(id))) throw new HttpError(404, 'Course not found');
  await db.execute('CALL sp_assign_lecturer(?, ?)', [id, userID]);
  res.status(201).json({ ok: true });
}));

router.delete('/:id/lecturers/:userId', authorize(...MEMBERS), asyncHandler(async (req, res) => {
  await db.execute('DELETE FROM tbl_course_lecturers WHERE courseID = ? AND userID = ?', [toId(req.params.id), toId(req.params.userId)]);
  res.json({ ok: true });
}));

router.post('/:id/students', authorize(...MEMBERS), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const userID = toId((req.body || {}).userId, 'user id');
  if (!(await courseExists(id))) throw new HttpError(404, 'Course not found');
  await db.execute('CALL sp_enroll_student(?, ?)', [id, userID]);
  res.status(201).json({ ok: true });
}));

router.delete('/:id/students/:userId', authorize(...MEMBERS), asyncHandler(async (req, res) => {
  await db.execute('DELETE FROM tbl_enrollments WHERE courseID = ? AND userID = ?', [toId(req.params.id), toId(req.params.userId)]);
  res.json({ ok: true });
}));

module.exports = router;
