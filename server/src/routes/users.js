// User management (Admin only per the role-permission matrix).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const { authorize } = require('../middleware/authorize');
const { asyncHandler, HttpError, toId, requireString, validatePassword } = require('../utils/http');

const router = express.Router();
const STATUSES = ['Active', 'Suspended'];

async function roleIdsFor(names) {
  if (!Array.isArray(names)) throw new HttpError(400, 'roles must be a list');
  const unique = [...new Set(names.map(String))];
  if (unique.length === 0) return [];
  const [rows] = await db.query('SELECT roleID, roleName FROM tbl_roles WHERE roleName IN (?)', [unique]);
  if (rows.length !== unique.length) throw new HttpError(400, 'One or more roles do not exist');
  return rows;
}

async function adminCount(excludeUserID) {
  const [[r]] = await db.execute(
    `SELECT COUNT(*) AS n FROM tbl_user_roles ur JOIN tbl_roles rl ON rl.roleID = ur.roleID
       JOIN tbl_users u ON u.userID = ur.userID
      WHERE rl.roleName = 'Admin' AND u.accountStatus = 'Active' AND u.userID <> ?`, [excludeUserID]);
  return Number(r.n);
}

router.get('/', authorize('/api/v1/users', 'READ'), asyncHandler(async (req, res) => {
  const [rows] = await db.execute(
    `SELECT u.userID AS id, u.username, u.fullName AS name, u.accountStatus, u.lastLoginAt, u.createdAt,
            (u.lockedUntil IS NOT NULL AND u.lockedUntil > UTC_TIMESTAMP()) AS locked,
            GROUP_CONCAT(r.roleName ORDER BY r.hierarchyLevel DESC SEPARATOR ',') AS roles
       FROM tbl_users u
       LEFT JOIN tbl_user_roles ur ON ur.userID = u.userID
       LEFT JOIN tbl_roles r ON r.roleID = ur.roleID
      GROUP BY u.userID ORDER BY u.fullName`);
  res.json(rows.map((u) => ({ ...u, locked: !!Number(u.locked), roles: u.roles ? u.roles.split(',') : [] })));
}));

router.post('/', authorize('/api/v1/users', 'CREATE'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const username = requireString(b.username, 'Username', { max: 50 }).toLowerCase();
  if (!/^[a-z0-9._@-]{3,50}$/.test(username)) throw new HttpError(400, 'Username may contain letters, digits, . _ - @ only');
  const fullName = requireString(b.fullName, 'Full name', { max: 100 });
  validatePassword(b.password);
  const roles = await roleIdsFor(b.roles || []);
  if (roles.length === 0) throw new HttpError(400, 'Assign at least one role');

  const hash = await bcrypt.hash(b.password, env.bcryptCost);
  let userID;
  try {
    const [r] = await db.execute('INSERT INTO tbl_users (username, fullName, passwordHash) VALUES (?, ?, ?)', [username, fullName, hash]);
    userID = r.insertId;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That username is already taken');
    throw e;
  }
  for (const role of roles) await db.execute('INSERT INTO tbl_user_roles (userID, roleID) VALUES (?, ?)', [userID, role.roleID]);
  res.status(201).json({ id: userID, username, name: fullName, roles: roles.map((r) => r.roleName) });
}));

router.put('/:id', authorize('/api/v1/users', 'UPDATE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const b = req.body || {};
  const [[u]] = await db.execute('SELECT userID, accountStatus FROM tbl_users WHERE userID = ?', [id]);
  if (!u) throw new HttpError(404, 'User not found');
  const fullName = b.fullName !== undefined ? requireString(b.fullName, 'Full name', { max: 100 }) : null;
  let status = null;
  if (b.accountStatus !== undefined) {
    if (!STATUSES.includes(b.accountStatus)) throw new HttpError(400, 'Status must be Active or Suspended');
    status = b.accountStatus;
    if (status !== 'Active' && id === req.user.id) throw new HttpError(400, 'You cannot suspend your own account');
  }
  await db.execute(
    // tokenVersion is assigned first so it compares against the old status; a status
    // change revokes the user's existing tokens immediately.
    `UPDATE tbl_users SET tokenVersion = tokenVersion + IF(? IS NOT NULL AND ? <> accountStatus, 1, 0),
            fullName = COALESCE(?, fullName), accountStatus = COALESCE(?, accountStatus)
      WHERE userID = ?`, [status, status, fullName, status, id]);
  res.json({ ok: true });
}));

// Replace the user's role assignments.
router.put('/:id/roles', authorize('/api/v1/users', 'UPDATE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const [[u]] = await db.execute('SELECT userID FROM tbl_users WHERE userID = ?', [id]);
  if (!u) throw new HttpError(404, 'User not found');
  const roles = await roleIdsFor((req.body || {}).roles || []);
  const names = roles.map((r) => r.roleName);
  if (id === req.user.id && !names.includes('Admin')) throw new HttpError(400, 'You cannot remove your own Admin role');

  // Removing a role must not leave the user holding course duties for it.
  if (!names.includes('Lecturer')) {
    const [[c]] = await db.execute('SELECT COUNT(*) AS n FROM tbl_course_lecturers WHERE userID = ?', [id]);
    if (Number(c.n) > 0) throw new HttpError(409, 'Remove this user from the courses they lecture before removing the Lecturer role');
  }
  if (!names.includes('Student')) {
    const [[c]] = await db.execute('SELECT COUNT(*) AS n FROM tbl_enrollments WHERE userID = ?', [id]);
    if (Number(c.n) > 0) throw new HttpError(409, 'Unenrol this user from their courses before removing the Student role');
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM tbl_user_roles WHERE userID = ?', [id]);
    for (const r of roles) await conn.execute('INSERT INTO tbl_user_roles (userID, roleID) VALUES (?, ?)', [id, r.roleID]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ ok: true, roles: names });
}));

router.post('/:id/reset-password', authorize('/api/v1/users', 'UPDATE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  validatePassword((req.body || {}).password);
  const hash = await bcrypt.hash(req.body.password, env.bcryptCost);
  const [r] = await db.execute(
    'UPDATE tbl_users SET passwordHash = ?, tokenVersion = tokenVersion + 1, failedAttempts = 0, lockedUntil = NULL WHERE userID = ?', [hash, id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'User not found');
  res.json({ ok: true });
}));

router.post('/:id/unlock', authorize('/api/v1/users', 'UPDATE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const [r] = await db.execute('UPDATE tbl_users SET failedAttempts = 0, lockedUntil = NULL WHERE userID = ?', [id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'User not found');
  res.json({ ok: true });
}));

router.delete('/:id', authorize('/api/v1/users', 'DELETE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account');
  const [[isAdmin]] = await db.execute(
    `SELECT COUNT(*) AS n FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID WHERE ur.userID = ? AND r.roleName = 'Admin'`, [id]);
  if (Number(isAdmin.n) > 0 && (await adminCount(id)) === 0) throw new HttpError(400, 'Cannot delete the last active administrator');
  const [r] = await db.execute('DELETE FROM tbl_users WHERE userID = ?', [id]);
  if (r.affectedRows === 0) throw new HttpError(404, 'User not found');
  res.json({ ok: true });
}));

module.exports = router;
