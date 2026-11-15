// Authentication module (Section 4.4.2).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const { issueToken } = require('../services/tokens');
const { logAccess } = require('../services/audit');
const { authenticate } = require('../middleware/authorize');
const { asyncHandler } = require('../utils/http');

const router = express.Router();
const GENERIC = 'Invalid username or password';
// Compared against when the username does not exist, so response time does not reveal it.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.bcryptCost);

async function rolesOf(userID) {
  const [rows] = await db.execute(
    `SELECT r.roleName FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID
      WHERE ur.userID = ? ORDER BY r.hierarchyLevel DESC`, [userID]);
  return rows.map((r) => r.roleName);
}

async function permissionsOf(roleName) {
  const [rows] = await db.execute(
    `SELECT p.resourceEndpoint, p.allowedAction FROM tbl_role_permissions rp
       JOIN tbl_roles r ON r.roleID = rp.roleID JOIN tbl_permissions p ON p.permissionID = rp.permissionID
      WHERE r.roleName = ?`, [roleName]);
  return rows.map((p) => `${p.resourceEndpoint}:${p.allowedAction}`);
}

const LOGIN = '/api/v1/auth/login';

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password, role } = req.body || {};
  const ip = req.ip;
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const uname = username.trim().toLowerCase().slice(0, 50);

  const [rows] = await db.execute(
    `SELECT userID, username, fullName, passwordHash, accountStatus, failedAttempts, lockedUntil, tokenVersion,
            (lockedUntil IS NOT NULL AND lockedUntil > UTC_TIMESTAMP()) AS isLocked,
            CEIL(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), lockedUntil) / 60) AS minutesLeft
       FROM tbl_users WHERE username = ?`, [uname]);
  const user = rows[0];

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await logAccess({ username: uname, resource: LOGIN, action: 'LOGIN', allowed: false, reason: 'Unknown username', ip });
    return res.status(401).json({ error: GENERIC });
  }

  // Lockout: after 5 consecutive failures the account is locked for 15 minutes (ST-09).
  if (Number(user.isLocked)) {
    await logAccess({ userID: user.userID, username: user.username, resource: LOGIN, action: 'LOGIN', allowed: false, reason: 'Account locked', ip });
    return res.status(423).json({ error: `Too many failed attempts. Try again in ${Math.max(1, Number(user.minutesLeft))} minute(s).` });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const failures = Number(user.failedAttempts) + 1;
    if (failures >= env.maxFailedLogins) {
      await db.execute(
        'UPDATE tbl_users SET failedAttempts = 0, lockedUntil = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE) WHERE userID = ?',
        [env.lockMinutes, user.userID]);
      await logAccess({ userID: user.userID, username: user.username, resource: LOGIN, action: 'LOGIN', allowed: false, reason: `Wrong password (${failures}); account locked for ${env.lockMinutes} min`, ip });
      return res.status(423).json({ error: `Too many failed attempts. Account locked for ${env.lockMinutes} minutes.` });
    }
    await db.execute('UPDATE tbl_users SET failedAttempts = ? WHERE userID = ?', [failures, user.userID]);
    await logAccess({ userID: user.userID, username: user.username, resource: LOGIN, action: 'LOGIN', allowed: false, reason: `Wrong password (${failures})`, ip });
    return res.status(401).json({ error: GENERIC });
  }

  // Account status check: suspended accounts cannot log in even with the right password (FT-03).
  if (user.accountStatus !== 'Active') {
    await logAccess({ userID: user.userID, username: user.username, resource: LOGIN, action: 'LOGIN', allowed: false, reason: `Account ${user.accountStatus}`, ip });
    return res.status(403).json({ error: 'This account is not active. Contact the administrator.' });
  }

  const roles = await rolesOf(user.userID);
  if (roles.length === 0) {
    await logAccess({ userID: user.userID, username: user.username, resource: LOGIN, action: 'LOGIN', allowed: false, reason: 'No role assigned', ip });
    return res.status(403).json({ error: 'No role has been assigned to this account. Contact the administrator.' });
  }

  // Role activation: a user holding several roles chooses one per session (RBAC96 sessions / DSD).
  let activeRole = roles.length === 1 ? roles[0] : null;
  if (role !== undefined && role !== null && role !== '') {
    if (!roles.includes(role)) {
      await logAccess({ userID: user.userID, username: user.username, resource: LOGIN, action: 'LOGIN', allowed: false, reason: `Requested unassigned role ${String(role).slice(0, 30)}`, ip });
      return res.status(403).json({ error: 'That role is not assigned to this account' });
    }
    activeRole = role;
  }

  await db.execute('UPDATE tbl_users SET failedAttempts = 0, lockedUntil = NULL WHERE userID = ?', [user.userID]);

  if (!activeRole) {
    // Password verified; ask the client which role to activate. No token is issued yet.
    return res.json({ chooseRole: true, roles });
  }

  await db.execute('UPDATE tbl_users SET lastLoginAt = UTC_TIMESTAMP() WHERE userID = ?', [user.userID]);
  await logAccess({ userID: user.userID, username: user.username, roleName: activeRole, resource: LOGIN, action: 'LOGIN', allowed: true, reason: 'Login successful', ip });
  res.json({
    token: issueToken(user, activeRole),
    expiresIn: env.jwtExpiresIn,
    user: { id: user.userID, username: user.username, name: user.fullName, role: activeRole, roles },
    permissions: await permissionsOf(activeRole),
  });
}));

// Current session details and the permission list used to build the role's menu.
router.get('/me', authenticate(), asyncHandler(async (req, res) => {
  res.json({
    user: { id: req.user.id, username: req.user.username, name: req.user.name, role: req.user.role, roles: await rolesOf(req.user.id) },
    permissions: await permissionsOf(req.user.role),
  });
}));

// Token refresh: re-checks account status and role (done by authenticate) before
// issuing a fresh 30-minute token. Expired tokens cannot be refreshed.
router.post('/refresh', authenticate(), asyncHandler(async (req, res) => {
  const token = issueToken({ userID: req.user.id, username: req.user.username, fullName: req.user.name, tokenVersion: req.user.tv }, req.user.role);
  res.json({ token, expiresIn: env.jwtExpiresIn });
}));

// Logout revokes every token issued to the account so far (FT-11).
router.post('/logout', authenticate(), asyncHandler(async (req, res) => {
  await db.execute('UPDATE tbl_users SET tokenVersion = tokenVersion + 1 WHERE userID = ?', [req.user.id]);
  await logAccess({ userID: req.user.id, username: req.user.username, roleName: req.user.role, resource: '/api/v1/auth/logout', action: 'LOGOUT', allowed: true, reason: 'Logged out', ip: req.ip });
  res.json({ ok: true });
}));

module.exports = router;
