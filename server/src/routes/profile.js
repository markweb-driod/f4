const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const { authorize } = require('../middleware/authorize');
const { asyncHandler, HttpError, validatePassword } = require('../utils/http');

const router = express.Router();

// Every role may read only its own profile (Table 4.4: "R (own profile only)").
router.get('/', authorize('/api/v1/profile', 'READ'), asyncHandler(async (req, res) => {
  const [[u]] = await db.execute(
    'SELECT userID AS id, username, fullName AS name, accountStatus, lastLoginAt, createdAt FROM tbl_users WHERE userID = ?',
    [req.user.id]);
  const [roles] = await db.execute(
    'SELECT r.roleName FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID WHERE ur.userID = ?', [req.user.id]);
  res.json({ ...u, activeRole: req.user.role, roles: roles.map((r) => r.roleName) });
}));

router.put('/password', authorize('/api/v1/profile/password', 'UPDATE'), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string') throw new HttpError(400, 'Current password is required');
  validatePassword(newPassword);
  const [[u]] = await db.execute('SELECT passwordHash FROM tbl_users WHERE userID = ?', [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, u.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, env.bcryptCost);
  // Changing the password also revokes all existing sessions.
  await db.execute('UPDATE tbl_users SET passwordHash = ?, tokenVersion = tokenVersion + 1 WHERE userID = ?', [hash, req.user.id]);
  res.json({ ok: true, message: 'Password changed. Please sign in again.' });
}));

module.exports = router;
