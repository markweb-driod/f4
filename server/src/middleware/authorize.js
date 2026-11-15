// RBAC security gatekeeper (Section 3.4.1 "Stateless Security Middleware", Section 4.4.3).
//
// Every protected route is declared with the resource and action it needs:
//   router.post('/grades/submit', authorize('/api/v1/grades/submit', 'CREATE'), handler)
//
// For each request the middleware:
//   1. verifies the signed JWT (401 if missing, tampered or expired);
//   2. re-checks the account in the database: it must still be Active, the token version
//      must match (logout / suspension revoke tokens at once) and the activated role must
//      still be assigned to the user;
//   3. looks the (role, resource, action) triple up in the permission matrix;
//   4. writes the decision to the audit log and rejects with 403 when not permitted.
// Because the matrix is read from the database, an administrator can change what a
// role may do without changing code.

const db = require('../config/db');
const { verifyToken, bearer } = require('../services/tokens');
const { logAccess } = require('../services/audit');

async function loadSession(req, resource, action) {
  const ip = req.ip;
  const token = bearer(req);
  if (!token) {
    await logAccess({ resource, action, allowed: false, reason: 'No token supplied', ip });
    return { status: 401, error: 'Authentication required' };
  }

  let claims;
  try {
    claims = verifyToken(token);
  } catch (err) {
    const reason = err.name === 'TokenExpiredError' ? 'Expired token' : 'Invalid token signature';
    await logAccess({ resource, action, allowed: false, reason, ip });
    return { status: 401, error: 'Invalid or expired token' };
  }

  const userID = Number(claims.sub);
  const [rows] = await db.execute(
    `SELECT u.userID, u.username, u.fullName, u.accountStatus, u.tokenVersion,
            EXISTS (SELECT 1 FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID
                     WHERE ur.userID = u.userID AND r.roleName = ?) AS hasRole
       FROM tbl_users u WHERE u.userID = ?`,
    [String(claims.role), userID]
  );
  const user = rows[0];
  const base = { userID, username: claims.username, roleName: claims.role, resource, action, ip };
  let reason = null;
  if (!user) reason = 'Account no longer exists';
  else if (user.accountStatus !== 'Active') reason = `Account is ${user.accountStatus}`;
  else if (Number(user.tokenVersion) !== Number(claims.tv)) reason = 'Token has been revoked';
  else if (!Number(user.hasRole)) reason = 'Role no longer assigned to user';
  if (reason) {
    await logAccess({ ...base, allowed: false, reason });
    return { status: 401, error: 'Session is no longer valid. Please sign in again.' };
  }
  return { claims, user: { id: userID, username: user.username, name: user.fullName, role: String(claims.role), tv: user.tokenVersion } };
}

// Authentication only (no permission lookup) - used by /auth/me, /auth/refresh, /auth/logout.
function authenticate() {
  return async (req, res, next) => {
    try {
      const s = await loadSession(req, req.baseUrl + req.path, 'AUTH');
      if (s.error) return res.status(s.status).json({ error: s.error });
      req.user = s.user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function authorize(resource, action) {
  return async (req, res, next) => {
    try {
      const s = await loadSession(req, resource, action);
      if (s.error) return res.status(s.status).json({ error: s.error });

      const [rows] = await db.execute(
        `SELECT 1 FROM tbl_role_permissions rp
           JOIN tbl_roles r       ON r.roleID = rp.roleID
           JOIN tbl_permissions p ON p.permissionID = rp.permissionID
          WHERE r.roleName = ? AND p.resourceEndpoint = ? AND p.allowedAction = ?`,
        [s.user.role, resource, action]
      );
      const allowed = rows.length > 0;
      await logAccess({
        userID: s.user.id, username: s.user.username, roleName: s.user.role,
        resource: `${req.method} ${req.originalUrl.split('?')[0]}`.slice(0, 150), action, allowed,
        reason: allowed ? null : `Role ${s.user.role} lacks ${action} on ${resource}`, ip: req.ip,
      });
      if (!allowed) return res.status(403).json({ error: 'Access denied for your role' });
      req.user = s.user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Ownership denial helper: records the refusal and returns 403 (ST-05, ST-06).
async function denyOwnership(req, res, action, reason) {
  await logAccess({
    userID: req.user.id, username: req.user.username, roleName: req.user.role,
    resource: `${req.method} ${req.originalUrl.split('?')[0]}`.slice(0, 150), action, allowed: false,
    reason: `Ownership check failed: ${reason}`, ip: req.ip,
  });
  return res.status(403).json({ error: 'Access denied: you do not own this resource' });
}

module.exports = { authorize, authenticate, denyOwnership };
