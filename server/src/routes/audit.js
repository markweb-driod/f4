// Audit log viewer (Admin): filter by user, resource, decision and date (Fig. 4.6).
const express = require('express');
const db = require('../config/db');
const { authorize } = require('../middleware/authorize');
const { asyncHandler, HttpError } = require('../utils/http');

const router = express.Router();

function buildFilter(q) {
  const where = [];
  const params = [];
  if (q.user) { where.push('(username LIKE ? OR CAST(userID AS CHAR) = ?)'); params.push(`%${String(q.user).slice(0, 50)}%`, String(q.user)); }
  if (q.resource) { where.push('resource LIKE ?'); params.push(`%${String(q.resource).slice(0, 100)}%`); }
  if (q.decision) {
    if (!['ALLOWED', 'DENIED'].includes(q.decision)) throw new HttpError(400, 'decision must be ALLOWED or DENIED');
    where.push('decision = ?'); params.push(q.decision);
  }
  if (q.role) { where.push('roleName = ?'); params.push(String(q.role).slice(0, 30)); }
  if (q.from) {
    const d = new Date(q.from); if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid from date');
    where.push('createdAt >= ?'); params.push(d);
  }
  if (q.to) {
    const d = new Date(q.to); if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid to date');
    where.push('createdAt <= ?'); params.push(d);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', authorize('/api/v1/audit-logs', 'READ'), asyncHandler(async (req, res) => {
  const { sql, params } = buildFilter(req.query);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM tbl_audit_logs ${sql}`, params);
  // LIMIT/OFFSET are validated integers, inlined because some MariaDB versions reject them as placeholders.
  const [rows] = await db.execute(
    `SELECT logID AS id, userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt
       FROM tbl_audit_logs ${sql} ORDER BY logID DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
  res.json({ total: Number(total), page, limit, rows });
}));

router.get('/summary', authorize('/api/v1/audit-logs', 'READ'), asyncHandler(async (req, res) => {
  const [[totals]] = await db.execute(
    `SELECT COUNT(*) AS total, SUM(decision = 'DENIED') AS denied,
            SUM(decision = 'DENIED' AND createdAt > UTC_TIMESTAMP() - INTERVAL 1 DAY) AS denied24h,
            SUM(action = 'LOGIN' AND decision = 'DENIED' AND createdAt > UTC_TIMESTAMP() - INTERVAL 1 DAY) AS failedLogins24h
       FROM tbl_audit_logs`);
  const [top] = await db.execute(
    `SELECT COALESCE(username, '(anonymous)') AS username, COUNT(*) AS denials FROM tbl_audit_logs
      WHERE decision = 'DENIED' AND createdAt > UTC_TIMESTAMP() - INTERVAL 7 DAY
      GROUP BY COALESCE(username, '(anonymous)') ORDER BY denials DESC LIMIT 5`);
  res.json({
    total: Number(totals.total || 0), denied: Number(totals.denied || 0),
    denied24h: Number(totals.denied24h || 0), failedLogins24h: Number(totals.failedLogins24h || 0),
    topDenied: top.map((t) => ({ username: t.username, denials: Number(t.denials) })),
  });
}));

module.exports = router;
