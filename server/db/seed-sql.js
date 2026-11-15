// Turns seed-data.js into plain SQL statements. The same statements are executed by
// `npm run db:setup` and written to rbac_elearning.sql by `npm run db:export`, so the
// phpMyAdmin import and the scripted setup always produce the same demo database.
//
// IDs are looked up with sub-queries (by username / course code) instead of being
// hard-coded, and dates are relative to UTC_TIMESTAMP() so the demo always looks current.

const { format, escape } = require('mysql2');
const seed = require('./seed-data');

const at = (hours) => `DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${Math.round(hours * 60)} MINUTE)`;
const userId = (username) => `(SELECT userID FROM tbl_users WHERE username = ${escape(username)})`;
const courseId = (code) => `(SELECT courseID FROM tbl_courses WHERE courseCode = ${escape(code)})`;

function resolveUser(key) {
  if (key.includes('@')) return key;
  const u = seed.USERS.find((x) => x.username.startsWith(`${key}@`));
  if (!u) throw new Error(`Unknown demo user "${key}"`);
  return u.username;
}

// hash: async (password) => bcrypt hash
async function buildSeedStatements(hash) {
  const out = [];
  const add = (sql, params) => out.push(params ? format(sql, params) : sql);

  out.push('-- Roles (Table 4.3)');
  for (const r of seed.ROLES) {
    add('INSERT INTO tbl_roles (roleName, hierarchyLevel, description) VALUES (?, ?, ?)', [r.roleName, r.hierarchyLevel, r.description]);
  }

  out.push('-- Permissions');
  for (const [resource, action, description] of seed.PERMISSIONS) {
    add('INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES (?, ?, ?)', [resource, action, description]);
  }

  out.push('-- Role-permission matrix (Table 4.4)');
  for (const [role, perms] of Object.entries(seed.MATRIX)) {
    for (const key of perms) {
      const i = key.lastIndexOf(':');
      const resource = key.slice(0, i);
      const action = key.slice(i + 1);
      if (!seed.PERMISSIONS.some(([r, a]) => r === resource && a === action)) throw new Error(`Unknown permission in matrix: ${key}`);
      out.push(`INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = ${escape(role)} AND p.resourceEndpoint = ${escape(resource)} AND p.allowedAction = ${escape(action)}`);
    }
  }

  out.push('-- Demo user accounts (passwords are bcrypt hashes of the test values in seed-data.js)');
  for (const u of seed.USERS) {
    const h = await hash(u.password);
    out.push(`INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES (${escape(u.username)}, ${escape(u.fullName)}, ${escape(h)}, ${escape(u.status || 'Active')}, ${u.lastLoginHours != null ? at(u.lastLoginHours) : 'NULL'}, ${at(-24 * 120)})`);
    for (const role of u.roles) {
      out.push(`INSERT INTO tbl_user_roles (userID, roleID) SELECT ${userId(u.username)}, roleID FROM tbl_roles WHERE roleName = ${escape(role)}`);
    }
  }

  for (const c of seed.COURSES) {
    out.push(`-- Course ${c.courseCode}`);
    add('INSERT INTO tbl_courses (courseCode, title, description, creditUnits, createdAt) VALUES (?, ?, ?, ?, ' + at(-24 * 90) + ')',
      [c.courseCode, c.title, c.description, c.creditUnits]);
    out.push(`SET @course = ${courseId(c.courseCode)}`);
    // Membership goes through the Separation-of-Duty procedures.
    for (const l of c.lecturers) out.push(`CALL sp_assign_lecturer(@course, ${userId(l)})`);
    for (const s of c.students) out.push(`CALL sp_enroll_student(@course, ${userId(s)})`);
    out.push(`SET @lecturer = ${userId(c.lecturers[0])}`);

    for (const m of c.materials || []) {
      out.push(`INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, ${escape(m.title)}, ${escape(m.body)}, @lecturer, ${at(m.hours)})`);
    }

    for (const a of c.assignments || []) {
      out.push(`INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, ${escape(a.title)}, ${escape(a.instructions)}, ${a.maxScore}, ${at(a.hours)}, @lecturer, ${at(Math.min(a.hours, 0) - 24 * 10)})`);
      out.push('SET @assignment = LAST_INSERT_ID()');
      Object.entries(a.submissions || {}).forEach(([key, content], i) => {
        // Past deadlines: submitted a little before the deadline. Open ones: recently.
        const when = a.hours < 0 ? a.hours - 2 - i * 5 : -3 - i * 4;
        out.push(`INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, ${userId(resolveUser(key))}, ${escape(content)}, ${at(when)})`);
      });
    }

    if (c.grades) {
      for (const [key, [score, remarks]] of Object.entries(c.grades.scores)) {
        // Written through the same stored procedure the application uses.
        out.push(`CALL sp_record_grade(@lecturer, @course, ${userId(resolveUser(key))}, ${Number(score)}, ${remarks ? escape(remarks) : 'NULL'})`);
      }
      if (c.grades.released) out.push('UPDATE tbl_grades SET released = 1 WHERE courseID = @course');
    }
  }

  out.push('-- Audit history');
  for (const [username, role, resource, action, decision, reason, ip, hoursAgo] of seed.AUDIT) {
    out.push(`INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES (${username ? userId(username) : 'NULL'}, ${escape(username)}, ${escape(role)}, ${escape(resource)}, ${escape(action)}, ${escape(decision)}, ${escape(reason)}, ${escape(ip)}, ${at(-hoursAgo)})`);
  }

  return out;
}

const isComment = (s) => s.startsWith('--');

module.exports = { buildSeedStatements, isComment };
