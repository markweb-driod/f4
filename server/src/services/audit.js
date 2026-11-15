const db = require('../config/db');

// Records an access decision in tbl_audit_logs (Section 4.4.1). The application DB
// account can only INSERT and SELECT on this table, so entries cannot be altered.
async function logAccess({ userID = null, username = null, roleName = null, resource, action, allowed, reason = null, ip = null }) {
  try {
    await db.execute(
      `INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userID, username, roleName, String(resource).slice(0, 150), String(action).slice(0, 10),
        allowed ? 'ALLOWED' : 'DENIED', reason ? String(reason).slice(0, 255) : null, ip ? String(ip).slice(0, 45) : null]
    );
  } catch (err) {
    // Auditing must never take the request down, but the failure must be visible.
    console.error('[audit] failed to write log entry:', err.message);
  }
}

module.exports = { logAccess };
