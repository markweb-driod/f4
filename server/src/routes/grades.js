const express = require('express');
const db = require('../config/db');
const { authorize, denyOwnership } = require('../middleware/authorize');
const { canViewCourse, canManageCourse, courseExists } = require('../services/ownership');
const { asyncHandler, HttpError, toId, optionalString } = require('../utils/http');

const router = express.Router();

// Record (or update) a student's grade for a course. The insert itself happens inside
// sp_record_grade, which repeats the role and ownership checks at database level (ST-01, ST-06, ST-11).
router.post('/submit', authorize('/api/v1/grades/submit', 'CREATE'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const courseID = toId(b.courseId, 'course id');
  const studentID = toId(b.studentId, 'student id');
  const score = Number(b.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new HttpError(400, 'Score must be a number between 0 and 100');
  if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
  if (!(await canManageCourse(req.user, courseID))) return denyOwnership(req, res, 'CREATE', `course ${courseID} not assigned`);
  await db.execute('CALL sp_record_grade(?, ?, ?, ?, ?)', [req.user.id, courseID, studentID, Math.round(score * 100) / 100, optionalString(b.remarks, 'Remarks', 255)]);
  res.status(201).json({ ok: true });
}));

// Bulk entry for a whole class list.
router.post('/submit-bulk', authorize('/api/v1/grades/submit', 'CREATE'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const courseID = toId(b.courseId, 'course id');
  if (!Array.isArray(b.entries) || b.entries.length === 0 || b.entries.length > 1000) throw new HttpError(400, 'entries must be a non-empty list');
  if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
  if (!(await canManageCourse(req.user, courseID))) return denyOwnership(req, res, 'CREATE', `course ${courseID} not assigned`);
  const clean = b.entries.map((e) => {
    const score = Number(e.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new HttpError(400, 'Every score must be between 0 and 100');
    return [toId(e.studentId, 'student id'), Math.round(score * 100) / 100, optionalString(e.remarks, 'Remarks', 255)];
  });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const [sid, score, remarks] of clean) await conn.execute('CALL sp_record_grade(?, ?, ?, ?, ?)', [req.user.id, courseID, sid, score, remarks]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.status(201).json({ ok: true, count: clean.length });
}));

// Release or withhold all grades of a course (students only see released grades - FT-08).
router.put('/release', authorize('/api/v1/grades', 'UPDATE'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const courseID = toId(b.courseId, 'course id');
  if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
  if (!(await canManageCourse(req.user, courseID))) return denyOwnership(req, res, 'UPDATE', `course ${courseID} not assigned`);
  await db.execute('CALL sp_release_grades(?, ?, ?)', [req.user.id, courseID, b.released ? 1 : 0]);
  res.json({ ok: true, released: !!b.released });
}));

// Grade sheet of a course (Lecturer of the course, or Admin read-only).
router.get('/course/:courseId', authorize('/api/v1/grades', 'READ'), asyncHandler(async (req, res) => {
  const courseID = toId(req.params.courseId);
  if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
  if (req.user.role === 'Student' || !(await canViewCourse(req.user, courseID))) {
    return denyOwnership(req, res, 'READ', `grade sheet of course ${courseID}`);
  }
  const [rows] = await db.execute(
    `SELECT u.userID AS studentId, u.fullName AS studentName, u.username, g.score, g.letter, g.remarks, g.released, g.updatedAt
       FROM tbl_enrollments e JOIN tbl_users u ON u.userID = e.userID
       LEFT JOIN tbl_grades g ON g.courseID = e.courseID AND g.studentID = e.userID
      WHERE e.courseID = ? ORDER BY u.fullName`, [courseID]);
  res.json(rows.map((r) => ({ ...r, score: r.score === null ? null : Number(r.score), released: r.released === null ? null : !!r.released })));
}));

// A student's grades. Students may only request their own ID, and see only released grades (ST-05, FT-09).
router.get('/student/:studentId', authorize('/api/v1/grades', 'READ'), asyncHandler(async (req, res) => {
  const studentID = toId(req.params.studentId);
  let sql = `SELECT g.courseID AS courseId, c.courseCode, c.title AS courseTitle, c.creditUnits, g.score, g.letter, g.remarks, g.released, g.updatedAt
               FROM tbl_grades g JOIN tbl_courses c ON c.courseID = g.courseID WHERE g.studentID = ?`;
  const params = [studentID];
  if (req.user.role === 'Student') {
    if (studentID !== req.user.id) return denyOwnership(req, res, 'READ', `grades of student ${studentID}`);
    sql += ' AND g.released = 1';
  } else if (req.user.role === 'Lecturer') {
    sql += ' AND g.courseID IN (SELECT courseID FROM tbl_course_lecturers WHERE userID = ?)';
    params.push(req.user.id);
  } else if (req.user.role !== 'Admin') {
    return denyOwnership(req, res, 'READ', 'role has no grade scope');
  }
  const [rows] = await db.execute(`${sql} ORDER BY c.courseCode`, params);
  res.json(rows.map((r) => ({ ...r, score: Number(r.score), released: !!r.released })));
}));

// Convenience: the signed-in student's own released grades.
router.get('/mine', authorize('/api/v1/grades', 'READ'), asyncHandler(async (req, res) => {
  if (req.user.role !== 'Student') return res.json([]);
  const [rows] = await db.execute(
    `SELECT g.courseID AS courseId, c.courseCode, c.title AS courseTitle, c.creditUnits, g.score, g.letter, g.remarks, g.updatedAt
       FROM tbl_grades g JOIN tbl_courses c ON c.courseID = g.courseID
      WHERE g.studentID = ? AND g.released = 1 ORDER BY c.courseCode`, [req.user.id]);
  res.json(rows.map((r) => ({ ...r, score: Number(r.score) })));
}));

module.exports = router;
