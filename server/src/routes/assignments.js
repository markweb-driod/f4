const express = require('express');
const db = require('../config/db');
const { authorize, denyOwnership } = require('../middleware/authorize');
const { canViewCourse, canManageCourse, courseExists, isEnrolled } = require('../services/ownership');
const { singleFile, removeFile, sendStored } = require('../services/upload');
const { asyncHandler, HttpError, toId, requireString, optionalString } = require('../utils/http');

const router = express.Router();

function parseDue(value) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new HttpError(400, 'A valid deadline is required');
  return d;
}

async function getAssignment(id) {
  const [[a]] = await db.execute('SELECT * FROM tbl_assignments WHERE assignmentID = ?', [id]);
  if (!a) throw new HttpError(404, 'Assignment not found');
  return a;
}

// All assignments relevant to the current session (dashboard view).
router.get('/assignments', authorize('/api/v1/assignments', 'READ'), asyncHandler(async (req, res) => {
  const select = `SELECT a.assignmentID AS id, a.courseID, c.courseCode, c.title AS courseTitle, a.title, a.instructions,
                         a.maxScore, a.dueAt, a.createdAt, (a.dueAt < UTC_TIMESTAMP()) AS closed`;
  let rows;
  if (req.user.role === 'Student') {
    [rows] = await db.execute(
      `${select}, s.submissionID, s.submittedAt
         FROM tbl_assignments a JOIN tbl_courses c ON c.courseID = a.courseID
         JOIN tbl_enrollments e ON e.courseID = a.courseID AND e.userID = ?
         LEFT JOIN tbl_submissions s ON s.assignmentID = a.assignmentID AND s.studentID = ?
        ORDER BY a.dueAt`, [req.user.id, req.user.id]);
  } else if (req.user.role === 'Lecturer') {
    [rows] = await db.execute(
      `${select}, (SELECT COUNT(*) FROM tbl_submissions s WHERE s.assignmentID = a.assignmentID) AS submissionCount,
              (SELECT COUNT(*) FROM tbl_enrollments e WHERE e.courseID = a.courseID) AS studentCount
         FROM tbl_assignments a JOIN tbl_courses c ON c.courseID = a.courseID
         JOIN tbl_course_lecturers cl ON cl.courseID = a.courseID AND cl.userID = ?
        ORDER BY a.dueAt`, [req.user.id]);
  } else {
    [rows] = await db.execute(`${select} FROM tbl_assignments a JOIN tbl_courses c ON c.courseID = a.courseID ORDER BY a.dueAt`);
  }
  res.json(rows.map((r) => ({ ...r, closed: !!Number(r.closed) })));
}));

router.get('/courses/:courseId/assignments', authorize('/api/v1/assignments', 'READ'), asyncHandler(async (req, res) => {
  const courseID = toId(req.params.courseId);
  if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
  if (!(await canViewCourse(req.user, courseID))) return denyOwnership(req, res, 'READ', `course ${courseID}`);
  const [rows] = await db.execute(
    `SELECT a.assignmentID AS id, a.title, a.instructions, a.maxScore, a.dueAt, a.createdAt, (a.dueAt < UTC_TIMESTAMP()) AS closed,
            (SELECT COUNT(*) FROM tbl_submissions s WHERE s.assignmentID = a.assignmentID) AS submissionCount,
            (SELECT s.submittedAt FROM tbl_submissions s WHERE s.assignmentID = a.assignmentID AND s.studentID = ?) AS mySubmittedAt
       FROM tbl_assignments a WHERE a.courseID = ? ORDER BY a.dueAt`, [req.user.id, courseID]);
  res.json(rows.map((r) => {
    const out = { ...r, closed: !!Number(r.closed) };
    // Students see only whether they submitted, not class-wide counts.
    if (req.user.role === 'Student') delete out.submissionCount; else delete out.mySubmittedAt;
    return out;
  }));
}));

router.post('/courses/:courseId/assignments', authorize('/api/v1/assignments', 'CREATE'), asyncHandler(async (req, res) => {
  const courseID = toId(req.params.courseId);
  if (!(await courseExists(courseID))) throw new HttpError(404, 'Course not found');
  if (!(await canManageCourse(req.user, courseID))) return denyOwnership(req, res, 'CREATE', `course ${courseID} not assigned`);
  const b = req.body || {};
  const title = requireString(b.title, 'Title', { max: 150 });
  const due = parseDue(b.dueAt);
  if (due.getTime() < Date.now()) throw new HttpError(400, 'The deadline must be in the future');
  const maxScore = Number(b.maxScore ?? 100);
  if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 1000) throw new HttpError(400, 'Maximum score must be 1-1000');
  const [r] = await db.execute(
    'INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy) VALUES (?, ?, ?, ?, ?, ?)',
    [courseID, title, optionalString(b.instructions, 'Instructions'), maxScore, due, req.user.id]);
  res.status(201).json({ id: r.insertId });
}));

router.put('/assignments/:id', authorize('/api/v1/assignments', 'UPDATE'), asyncHandler(async (req, res) => {
  const a = await getAssignment(toId(req.params.id));
  if (!(await canManageCourse(req.user, a.courseID))) return denyOwnership(req, res, 'UPDATE', `assignment ${a.assignmentID}`);
  const b = req.body || {};
  const title = b.title !== undefined ? requireString(b.title, 'Title', { max: 150 }) : a.title;
  const instructions = b.instructions !== undefined ? optionalString(b.instructions, 'Instructions') : a.instructions;
  const due = b.dueAt !== undefined ? parseDue(b.dueAt) : a.dueAt;
  await db.execute('UPDATE tbl_assignments SET title = ?, instructions = ?, dueAt = ? WHERE assignmentID = ?', [title, instructions, due, a.assignmentID]);
  res.json({ ok: true });
}));

router.delete('/assignments/:id', authorize('/api/v1/assignments', 'DELETE'), asyncHandler(async (req, res) => {
  const a = await getAssignment(toId(req.params.id));
  if (!(await canManageCourse(req.user, a.courseID))) return denyOwnership(req, res, 'DELETE', `assignment ${a.assignmentID}`);
  const [subs] = await db.execute('SELECT filePath FROM tbl_submissions WHERE assignmentID = ?', [a.assignmentID]);
  await db.execute('DELETE FROM tbl_assignments WHERE assignmentID = ?', [a.assignmentID]);
  subs.forEach((s) => removeFile(s.filePath));
  res.json({ ok: true });
}));

// ---- Submissions ----

// Student submits (or resubmits) before the deadline (FT-07).
router.post('/assignments/:id/submissions', authorize('/api/v1/submissions', 'CREATE'), singleFile('file'), asyncHandler(async (req, res) => {
  const f = req.file;
  try {
    const a = await getAssignment(toId(req.params.id));
    if (req.user.role !== 'Student' || !(await isEnrolled(req.user.id, a.courseID))) {
      removeFile(f && f.filename);
      return denyOwnership(req, res, 'CREATE', `not enrolled in course ${a.courseID}`);
    }
    if (new Date(a.dueAt).getTime() < Date.now()) throw new HttpError(400, 'The deadline for this assignment has passed');
    const content = optionalString(req.body.content, 'Answer', 20000);
    if (!f && !content) throw new HttpError(400, 'Attach a file or type your answer');

    const [[old]] = await db.execute('SELECT submissionID, filePath FROM tbl_submissions WHERE assignmentID = ? AND studentID = ?', [a.assignmentID, req.user.id]);
    if (old) {
      await db.execute(
        `UPDATE tbl_submissions SET content = ?, filePath = ?, originalName = ?, mimeType = ?, fileSize = ?, submittedAt = UTC_TIMESTAMP()
          WHERE submissionID = ?`,
        [content, f ? f.filename : null, f ? f.originalname.slice(0, 255) : null, f ? f.mimetype : null, f ? f.size : null, old.submissionID]);
      removeFile(old.filePath);
      return res.json({ id: old.submissionID, resubmitted: true });
    }
    const [r] = await db.execute(
      `INSERT INTO tbl_submissions (assignmentID, studentID, content, filePath, originalName, mimeType, fileSize)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.assignmentID, req.user.id, content, f ? f.filename : null, f ? f.originalname.slice(0, 255) : null, f ? f.mimetype : null, f ? f.size : null]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    removeFile(f && f.filename);
    throw e;
  }
}));

// Lecturer of the course sees all submissions; a student sees only their own.
router.get('/assignments/:id/submissions', authorize('/api/v1/submissions', 'READ'), asyncHandler(async (req, res) => {
  const a = await getAssignment(toId(req.params.id));
  const sql = `SELECT s.submissionID AS id, s.studentID AS studentId, u.fullName AS studentName, u.username, s.content,
                      s.originalName, s.fileSize, s.submittedAt
                 FROM tbl_submissions s JOIN tbl_users u ON u.userID = s.studentID WHERE s.assignmentID = ?`;
  if (req.user.role === 'Lecturer') {
    if (!(await canManageCourse(req.user, a.courseID))) return denyOwnership(req, res, 'READ', `assignment ${a.assignmentID}`);
    const [rows] = await db.execute(`${sql} ORDER BY u.fullName`, [a.assignmentID]);
    return res.json(rows);
  }
  if (req.user.role === 'Student') {
    if (!(await isEnrolled(req.user.id, a.courseID))) return denyOwnership(req, res, 'READ', `assignment ${a.assignmentID}`);
    const [rows] = await db.execute(`${sql} AND s.studentID = ?`, [a.assignmentID, req.user.id]);
    return res.json(rows);
  }
  return denyOwnership(req, res, 'READ', 'role has no submission scope');
}));

router.get('/submissions/:id/download', authorize('/api/v1/submissions', 'READ'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const [[s]] = await db.execute(
    `SELECT s.*, a.courseID FROM tbl_submissions s JOIN tbl_assignments a ON a.assignmentID = s.assignmentID WHERE s.submissionID = ?`, [id]);
  if (!s) throw new HttpError(404, 'Submission not found');
  const ownStudent = req.user.role === 'Student' && s.studentID === req.user.id;
  const ownLecturer = req.user.role === 'Lecturer' && (await canManageCourse(req.user, s.courseID));
  if (!ownStudent && !ownLecturer) return denyOwnership(req, res, 'READ', `submission ${id}`);
  if (!s.filePath) throw new HttpError(404, 'This submission has no attached file');
  sendStored(res, s.filePath, s.originalName, s.mimeType);
}));

module.exports = router;
