// Ownership checks applied on top of the role-permission matrix (Section 4.4.4):
// a lecturer may act only on courses assigned to them; a student only on courses
// they are enrolled in and only on their own submissions and grades.
const db = require('../config/db');

async function isCourseLecturer(userID, courseID) {
  const [r] = await db.execute('SELECT 1 FROM tbl_course_lecturers WHERE userID = ? AND courseID = ?', [userID, courseID]);
  return r.length > 0;
}

async function isEnrolled(userID, courseID) {
  const [r] = await db.execute('SELECT 1 FROM tbl_enrollments WHERE userID = ? AND courseID = ?', [userID, courseID]);
  return r.length > 0;
}

// Can the current session (user + active role) see this course?
async function canViewCourse(user, courseID) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Lecturer') return isCourseLecturer(user.id, courseID);
  if (user.role === 'Student') return isEnrolled(user.id, courseID);
  return false;
}

// Can the current session manage (write) this course's content?
async function canManageCourse(user, courseID) {
  return user.role === 'Lecturer' && isCourseLecturer(user.id, courseID);
}

async function courseExists(courseID) {
  const [r] = await db.execute('SELECT courseID FROM tbl_courses WHERE courseID = ?', [courseID]);
  return r.length > 0;
}

module.exports = { isCourseLecturer, isEnrolled, canViewCourse, canManageCourse, courseExists };
