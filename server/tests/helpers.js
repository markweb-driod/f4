const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

const USERS = {
  admin: { username: 'admin@nsuk.edu.ng', password: 'Admin@12345' },
  lecturer: { username: 'n.ajumobi@nsuk.edu.ng', password: 'Lecturer@123' },
  lecturer2: { username: 'b.ajayi@nsuk.edu.ng', password: 'Lecturer@123' },
  student: { username: 'peace.o@student.nsuk.edu.ng', password: 'Student@123' },
  student2: { username: 'musa.a@student.nsuk.edu.ng', password: 'Student@123' },
  student3: { username: 'grace.e@student.nsuk.edu.ng', password: 'Student@123' },
  assistant: { username: 'ta.john@nsuk.edu.ng', password: 'Assist@123' },
};

async function login(who, role) {
  const res = await request(app).post('/api/v1/auth/login').send({ ...USERS[who], role });
  if (!res.body.token) throw new Error(`Login failed for ${who}: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function idOf(username) {
  const [[u]] = await db.execute('SELECT userID FROM tbl_users WHERE username = ?', [username]);
  return u.userID;
}

async function courseId(code) {
  const [[c]] = await db.execute('SELECT courseID FROM tbl_courses WHERE courseCode = ?', [code]);
  return c.courseID;
}

async function lastAudit() {
  const [[row]] = await db.execute('SELECT * FROM tbl_audit_logs ORDER BY logID DESC LIMIT 1');
  return row;
}

module.exports = { request, app, db, USERS, login, auth, idOf, courseId, lastAudit };
