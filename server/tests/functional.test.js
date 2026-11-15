// Functional test cases FT-01 to FT-11 (Table 4.5).
const { request, app, db, USERS, login, auth, idOf, courseId } = require('./helpers');

afterAll(() => db.end());

describe('Functional tests (Table 4.5)', () => {
  let admin, lecturer, student, cmp401, peaceId;

  beforeAll(async () => {
    admin = await login('admin');
    lecturer = await login('lecturer');
    student = await login('student');
    cmp401 = await courseId('CMP 401');
    peaceId = await idOf(USERS.student.username);
  });

  test('FT-01 login with valid credentials returns a token and the role', async () => {
    const res = await request(app).post('/api/v1/auth/login').send(USERS.lecturer);
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('Lecturer');
    expect(res.body.permissions).toContain('/api/v1/grades/submit:CREATE');
    expect(res.body.permissions).not.toContain('/api/v1/users:READ');
  });

  test('FT-01b a user with two roles must pick one, and gets only that role', async () => {
    const first = await request(app).post('/api/v1/auth/login').send(USERS.assistant);
    expect(first.body.chooseRole).toBe(true);
    expect(first.body.token).toBeUndefined();
    expect(first.body.roles.sort()).toEqual(['Lecturer', 'Student']);
    const second = await request(app).post('/api/v1/auth/login').send({ ...USERS.assistant, role: 'Student' });
    expect(second.body.user.role).toBe('Student');
    const bad = await request(app).post('/api/v1/auth/login').send({ ...USERS.assistant, role: 'Admin' });
    expect(bad.status).toBe(403);
  });

  test('FT-02 wrong password is refused with a general message', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ ...USERS.student3, password: 'Wrong@123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid username or password');
    const unknown = await request(app).post('/api/v1/auth/login').send({ username: 'nobody@nsuk.edu.ng', password: 'Wrong@123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toBe(res.body.error); // usernames cannot be discovered
    await db.execute('UPDATE tbl_users SET failedAttempts = 0 WHERE username = ?', [USERS.student3.username]);
  });

  test('FT-03 a suspended account cannot log in, even with the right password', async () => {
    const created = await request(app).post('/api/v1/users').set(auth(admin.token))
      .send({ username: 'suspend.me@student.nsuk.edu.ng', fullName: 'Suspend Me', password: 'Temp@1234', roles: ['Student'] });
    expect(created.status).toBe(201);
    const s = await request(app).post('/api/v1/auth/login').send({ username: 'suspend.me@student.nsuk.edu.ng', password: 'Temp@1234' });
    expect(s.status).toBe(200);
    await request(app).put(`/api/v1/users/${created.body.id}`).set(auth(admin.token)).send({ accountStatus: 'Suspended' }).expect(200);
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'suspend.me@student.nsuk.edu.ng', password: 'Temp@1234' });
    expect(res.status).toBe(403);
    // The token issued before suspension stops working immediately.
    await request(app).get('/api/v1/profile').set(auth(s.body.token)).expect(401);
  });

  test('FT-04 admin creates a user and the role appears in tbl_user_roles', async () => {
    const res = await request(app).post('/api/v1/users').set(auth(admin.token))
      .send({ username: 'new.lecturer@nsuk.edu.ng', fullName: 'New Lecturer', password: 'Lect@12345', roles: ['Lecturer'] });
    expect(res.status).toBe(201);
    const [rows] = await db.execute(
      `SELECT r.roleName FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID WHERE ur.userID = ?`, [res.body.id]);
    expect(rows.map((r) => r.roleName)).toEqual(['Lecturer']);
    const weak = await request(app).post('/api/v1/users').set(auth(admin.token))
      .send({ username: 'weak@nsuk.edu.ng', fullName: 'Weak', password: 'password', roles: ['Student'] });
    expect(weak.status).toBe(400);
  });

  test('FT-05 lecturer uploads course material, visible to enrolled students', async () => {
    const res = await request(app).post(`/api/v1/courses/${cmp401}/materials`).set(auth(lecturer.token))
      .field('title', 'Week 2: Access control models').field('description', 'RBAC96 and the principle of least privilege')
      .attach('file', Buffer.from('%PDF-1.4 test'), 'week2.pdf');
    expect(res.status).toBe(201);
    const list = await request(app).get(`/api/v1/courses/${cmp401}/materials`).set(auth(student.token));
    expect(list.status).toBe(200);
    const m = list.body.find((x) => x.id === res.body.id);
    expect(m.title).toBe('Week 2: Access control models');
    const dl = await request(app).get(`/api/v1/materials/${res.body.id}/download`).set(auth(student.token));
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('week2.pdf');
  });

  test('FT-05b disallowed file types are rejected', async () => {
    const res = await request(app).post(`/api/v1/courses/${cmp401}/materials`).set(auth(lecturer.token))
      .field('title', 'Bad').attach('file', Buffer.from('MZ'), 'virus.exe');
    expect(res.status).toBe(400);
  });

  let assignmentId;
  test('FT-06 lecturer creates an assignment that appears on students\' dashboards', async () => {
    const due = new Date(Date.now() + 3 * 86400000).toISOString();
    const res = await request(app).post(`/api/v1/courses/${cmp401}/assignments`).set(auth(lecturer.token))
      .send({ title: 'RBAC case study', instructions: 'Compare RBAC and ABAC.', dueAt: due });
    expect(res.status).toBe(201);
    assignmentId = res.body.id;
    const mine = await request(app).get('/api/v1/assignments').set(auth(student.token));
    expect(mine.body.map((a) => a.id)).toContain(assignmentId);
  });

  test('FT-07 student submits before the deadline; the lecturer sees it', async () => {
    const res = await request(app).post(`/api/v1/assignments/${assignmentId}/submissions`).set(auth(student.token))
      .field('content', 'RBAC assigns permissions to roles, ABAC evaluates attributes.');
    expect(res.status).toBe(201);
    const subs = await request(app).get(`/api/v1/assignments/${assignmentId}/submissions`).set(auth(lecturer.token));
    expect(subs.status).toBe(200);
    expect(subs.body).toHaveLength(1);
    expect(subs.body[0].studentId).toBe(peaceId);
  });

  test('FT-07b submissions after the deadline are refused', async () => {
    await db.query('UPDATE tbl_assignments SET dueAt = UTC_TIMESTAMP() - INTERVAL 1 HOUR WHERE assignmentID = ?', [assignmentId]);
    const res = await request(app).post(`/api/v1/assignments/${assignmentId}/submissions`).set(auth(student.token)).field('content', 'Late');
    expect(res.status).toBe(400);
  });

  test('FT-08 lecturer records grades; students see them only after release', async () => {
    const res = await request(app).post('/api/v1/grades/submit').set(auth(lecturer.token))
      .send({ courseId: cmp401, studentId: peaceId, score: 68, remarks: 'Good work' });
    expect(res.status).toBe(201);
    const cmp401Grade = (list) => list.find((g) => g.courseCode === 'CMP 401');
    let mine = await request(app).get('/api/v1/grades/mine').set(auth(student.token));
    expect(cmp401Grade(mine.body)).toBeUndefined();
    await request(app).put('/api/v1/grades/release').set(auth(lecturer.token)).send({ courseId: cmp401, released: true }).expect(200);
    mine = await request(app).get('/api/v1/grades/mine').set(auth(student.token));
    expect(cmp401Grade(mine.body)).toMatchObject({ score: 68, letter: 'B' });
  });

  test('FT-09 student sees only their own released grades', async () => {
    const other = await idOf(USERS.student2.username);
    await request(app).post('/api/v1/grades/submit').set(auth(lecturer.token)).send({ courseId: cmp401, studentId: other, score: 81 }).expect(201);
    const res = await request(app).get(`/api/v1/grades/student/${peaceId}`).set(auth(student.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((g) => g.released)).toBe(true);
    expect(res.body.find((g) => g.courseCode === 'CMP 401').score).toBe(68);
    // Demo data: Peace's CMP 307 grade is recorded but not released, so it must not appear.
    expect(res.body.find((g) => g.courseCode === 'CMP 307')).toBeUndefined();
    const [[hidden]] = await db.execute(
      `SELECT COUNT(*) AS n FROM tbl_grades g JOIN tbl_courses c ON c.courseID = g.courseID WHERE g.studentID = ? AND c.courseCode = 'CMP 307'`, [peaceId]);
    expect(Number(hidden.n)).toBe(1);
  });

  test('FT-10 admin views the audit log with user, resource, decision and time', async () => {
    const res = await request(app).get('/api/v1/audit-logs?limit=20').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.rows[0]).toEqual(expect.objectContaining({
      username: expect.any(String), resource: expect.any(String), decision: expect.stringMatching(/ALLOWED|DENIED/), createdAt: expect.anything(),
    }));
    const denied = await request(app).get('/api/v1/audit-logs?decision=DENIED').set(auth(admin.token));
    expect(denied.body.rows.every((r) => r.decision === 'DENIED')).toBe(true);
  });

  test('FT-11 logout revokes the token on the server', async () => {
    const s = await login('student2');
    await request(app).get('/api/v1/profile').set(auth(s.token)).expect(200);
    await request(app).post('/api/v1/auth/logout').set(auth(s.token)).expect(200);
    await request(app).get('/api/v1/profile').set(auth(s.token)).expect(401);
  });

  test('token refresh re-checks the account and issues a new token', async () => {
    const s = await login('student3');
    const r = await request(app).post('/api/v1/auth/refresh').set(auth(s.token));
    expect(r.status).toBe(200);
    await request(app).get('/api/v1/courses').set(auth(r.body.token)).expect(200);
  });

  test('admin can change the permission matrix without code changes', async () => {
    const s = await login('student3');
    await request(app).get('/api/v1/assignments').set(auth(s.token)).expect(200);
    const roles = await request(app).get('/api/v1/roles').set(auth(admin.token));
    const studentRole = roles.body.roles.find((r) => r.name === 'Student');
    const perm = roles.body.permissions.find((p) => p.resource === '/api/v1/assignments' && p.action === 'READ');
    const original = roles.body.matrix[studentRole.id];
    await request(app).put(`/api/v1/roles/${studentRole.id}/permissions`).set(auth(admin.token))
      .send({ permissionIds: original.filter((id) => id !== perm.id) }).expect(200);
    await request(app).get('/api/v1/assignments').set(auth(s.token)).expect(403);
    await request(app).put(`/api/v1/roles/${studentRole.id}/permissions`).set(auth(admin.token)).send({ permissionIds: original }).expect(200);
    await request(app).get('/api/v1/assignments').set(auth(s.token)).expect(200);
  });

  test('the Admin role cannot remove its own permission-management rights', async () => {
    const roles = await request(app).get('/api/v1/roles').set(auth(admin.token));
    const adminRole = roles.body.roles.find((r) => r.name === 'Admin');
    const res = await request(app).put(`/api/v1/roles/${adminRole.id}/permissions`).set(auth(admin.token)).send({ permissionIds: [] });
    expect(res.status).toBe(400);
  });
});
