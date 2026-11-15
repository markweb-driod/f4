// Security test cases ST-01 to ST-12 (Table 4.6), plus database-level isolation checks.
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { request, app, db, USERS, login, auth, idOf, courseId, lastAudit } = require('./helpers');

afterAll(() => db.end());

describe('Security tests (Table 4.6)', () => {
  let admin, lecturer, lecturer2, student, cmp401, cmp405, peaceId, musaId;

  beforeAll(async () => {
    admin = await login('admin');
    lecturer = await login('lecturer');
    lecturer2 = await login('lecturer2');
    student = await login('student');
    cmp401 = await courseId('CMP 401');
    cmp405 = await courseId('CMP 405');
    peaceId = await idOf(USERS.student.username);
    musaId = await idOf(USERS.student2.username);
  });

  test('ST-01 student token POSTing to /api/v1/grades/submit gets 403 and is audited', async () => {
    const res = await request(app).post('/api/v1/grades/submit').set(auth(student.token))
      .send({ courseId: cmp401, studentId: peaceId, score: 100 });
    expect(res.status).toBe(403);
    const log = await lastAudit();
    expect(log).toMatchObject({ userID: peaceId, decision: 'DENIED', action: 'CREATE' });
    expect(log.resource).toContain('/api/v1/grades/submit');
    const [g] = await db.execute('SELECT * FROM tbl_grades WHERE studentID = ? AND score = 100', [peaceId]);
    expect(g).toHaveLength(0);
  });

  test('ST-02 changing the role claim from Student to Lecturer breaks the signature (401)', async () => {
    const [h, p, s] = student.token.split('.');
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    claims.role = 'Lecturer';
    const forged = [h, Buffer.from(JSON.stringify(claims)).toString('base64url'), s].join('.');
    const res = await request(app).post('/api/v1/grades/submit').set(auth(forged)).send({ courseId: cmp401, studentId: peaceId, score: 100 });
    expect(res.status).toBe(401);
    // An unsigned token (alg "none") is refused too.
    const none = jwt.sign(claims, null, { algorithm: 'none' });
    await request(app).get('/api/v1/courses').set(auth(none)).expect(401);
    // So is a token signed with a different secret.
    const other = jwt.sign(claims, 'not-the-server-secret-but-long-enough-0123456789', { algorithm: 'HS256' });
    await request(app).get('/api/v1/courses').set(auth(other)).expect(401);
  });

  test('ST-03 an expired token is refused with 401', async () => {
    const claims = jwt.decode(student.token);
    const expired = jwt.sign({ ...claims, iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app).get('/api/v1/courses').set(auth(expired));
    expect(res.status).toBe(401);
    expect((await lastAudit()).reason).toBe('Expired token');
  });

  test('ST-04 a protected route without a token is refused with 401', async () => {
    await request(app).get('/api/v1/users').expect(401);
    await request(app).post('/api/v1/grades/submit').send({}).expect(401);
    await request(app).get('/api/v1/users').set('Authorization', 'Basic YWRtaW46YWRtaW4=').expect(401);
  });

  test('ST-05 a student cannot read another student\'s grades by changing the ID', async () => {
    const res = await request(app).get(`/api/v1/grades/student/${musaId}`).set(auth(student.token));
    expect(res.status).toBe(403);
    expect((await lastAudit()).reason).toMatch(/Ownership check failed/);
    await request(app).get(`/api/v1/grades/course/${cmp401}`).set(auth(student.token)).expect(403);
  });

  test('ST-05b a student cannot open a course they are not enrolled in', async () => {
    const grace = await login('student3'); // enrolled in CMP 401 and CMP 311 only
    await request(app).get(`/api/v1/courses/${cmp405}`).set(auth(grace.token)).expect(403);
    await request(app).get(`/api/v1/courses/${cmp405}/materials`).set(auth(grace.token)).expect(403);
  });

  test('ST-06 a lecturer cannot edit grades for a course not assigned to them', async () => {
    // b.ajayi teaches CMP 405 only; Peace is enrolled in CMP 401.
    const res = await request(app).post('/api/v1/grades/submit').set(auth(lecturer2.token))
      .send({ courseId: cmp401, studentId: peaceId, score: 10 });
    expect(res.status).toBe(403);
    await request(app).put('/api/v1/grades/release').set(auth(lecturer2.token)).send({ courseId: cmp401, released: true }).expect(403);
    await request(app).post(`/api/v1/courses/${cmp401}/materials`).set(auth(lecturer2.token)).field('title', 'x').field('description', 'y').expect(403);
  });

  test('ST-07 a lecturer cannot use user management', async () => {
    await request(app).get('/api/v1/users').set(auth(lecturer.token)).expect(403);
    await request(app).post('/api/v1/users').set(auth(lecturer.token))
      .send({ username: 'x@nsuk.edu.ng', fullName: 'X', password: 'Xx@123456', roles: ['Admin'] }).expect(403);
    const me = await request(app).get('/api/v1/auth/me').set(auth(lecturer.token));
    expect(me.body.permissions).not.toContain('/api/v1/users:READ'); // option not shown in the menu
  });

  test('ST-08 SQL injection in the login form is treated as text', async () => {
    for (const username of ["' OR '1'='1", "admin@nsuk.edu.ng' -- ", "' OR 1=1; DROP TABLE tbl_users; --"]) {
      const res = await request(app).post('/api/v1/auth/login').send({ username, password: "' OR '1'='1" });
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    }
    const [[n]] = await db.execute('SELECT COUNT(*) AS n FROM tbl_users');
    expect(Number(n.n)).toBeGreaterThan(0);
  });

  test('ST-09 five wrong passwords lock the account for 15 minutes', async () => {
    await request(app).post('/api/v1/users').set(auth(admin.token))
      .send({ username: 'lock.test@student.nsuk.edu.ng', fullName: 'Lock Test', password: 'Right@1234', roles: ['Student'] }).expect(201);
    const creds = { username: 'lock.test@student.nsuk.edu.ng' };
    for (let i = 1; i <= 4; i++) {
      const r = await request(app).post('/api/v1/auth/login').send({ ...creds, password: 'Wrong@1234' });
      expect(r.status).toBe(401);
    }
    const fifth = await request(app).post('/api/v1/auth/login').send({ ...creds, password: 'Wrong@1234' });
    expect(fifth.status).toBe(423);
    // The sixth attempt, even with the correct password, is still refused.
    const sixth = await request(app).post('/api/v1/auth/login').send({ ...creds, password: 'Right@1234' });
    expect(sixth.status).toBe(423);
    const [[u]] = await db.execute(
      'SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), lockedUntil) AS mins FROM tbl_users WHERE username = ?', [creds.username]);
    expect(Number(u.mins)).toBeGreaterThanOrEqual(14);
  });

  test('ST-10 one account cannot be Lecturer and Student of the same course (SoD)', async () => {
    const ta = await idOf(USERS.assistant.username); // Student in CMP 405, Lecturer of CMP 311
    const asLecturer = await request(app).post(`/api/v1/courses/${cmp405}/lecturers`).set(auth(admin.token)).send({ userId: ta });
    expect(asLecturer.status).toBe(409);
    expect(asLecturer.body.error).toMatch(/Separation of Duty/);
    const cmp311 = await courseId('CMP 311');
    const asStudent = await request(app).post(`/api/v1/courses/${cmp311}/students`).set(auth(admin.token)).send({ userId: ta });
    expect(asStudent.status).toBe(409);
  });

  test('ST-11 the grade stored procedure refuses a student account', async () => {
    await expect(db.execute('CALL sp_record_grade(?, ?, ?, ?, ?)', [peaceId, cmp401, peaceId, 100, 'self-graded']))
      .rejects.toMatchObject({ sqlState: '45000' });
    // A lecturer not assigned to the course is refused too.
    const ajayi = await idOf(USERS.lecturer2.username);
    await expect(db.execute('CALL sp_record_grade(?, ?, ?, ?, ?)', [ajayi, cmp401, peaceId, 100, null]))
      .rejects.toMatchObject({ sqlState: '45000' });
  });

  test('ST-11b the application DB account cannot write grades or erase the audit log directly', async () => {
    await expect(db.execute('UPDATE tbl_grades SET score = 100')).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(db.execute('INSERT INTO tbl_grades (courseID, studentID, score, letter) VALUES (?, ?, 100, "A")', [cmp401, peaceId]))
      .rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(db.execute('DELETE FROM tbl_audit_logs')).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(db.execute('UPDATE tbl_audit_logs SET decision = "ALLOWED"')).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(db.execute('INSERT INTO tbl_enrollments (courseID, userID) VALUES (?, ?)', [cmp405, await idOf(USERS.student3.username)]))
      .rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
  });

  test('ST-12 the users table stores only bcrypt hashes', async () => {
    const [rows] = await db.execute('SELECT username, passwordHash FROM tbl_users');
    for (const r of rows) {
      expect(r.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
      for (const pw of Object.values(USERS).map((u) => u.password)) expect(r.passwordHash).not.toContain(pw);
    }
    const list = await request(app).get('/api/v1/users').set(auth(admin.token));
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  test('security headers are set (helmet) and API responses are not cached', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('removing a role from a user revokes their access on the next request', async () => {
    const created = await request(app).post('/api/v1/users').set(auth(admin.token))
      .send({ username: 'revoke.me@nsuk.edu.ng', fullName: 'Revoke Me', password: 'Revoke@123', roles: ['Lecturer', 'Student'] });
    const s = await request(app).post('/api/v1/auth/login').send({ username: 'revoke.me@nsuk.edu.ng', password: 'Revoke@123', role: 'Lecturer' });
    await request(app).get('/api/v1/courses').set(auth(s.body.token)).expect(200);
    await request(app).put(`/api/v1/users/${created.body.id}/roles`).set(auth(admin.token)).send({ roles: ['Student'] }).expect(200);
    await request(app).get('/api/v1/courses').set(auth(s.body.token)).expect(401);
  });

  test('the application DB account cannot drop tables or create database users', async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    });
    try {
      await expect(conn.query('DROP TABLE tbl_audit_logs')).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
      await expect(conn.query('CREATE USER x@localhost')).rejects.toBeTruthy();
    } finally {
      await conn.end();
    }
  });
});
