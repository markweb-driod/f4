// Roles and the role-permission matrix. Changing the matrix changes what a role may do
// without touching program code (Section 4.4.3).
const express = require('express');
const db = require('../config/db');
const { authorize } = require('../middleware/authorize');
const { asyncHandler, HttpError, toId, requireString, optionalString } = require('../utils/http');

const router = express.Router();
const CORE_ROLES = ['Admin', 'Lecturer', 'Student'];
// Permissions the Admin role must always keep, so administrators cannot lock themselves out.
const ADMIN_LOCKED = ['/api/v1/roles:READ', '/api/v1/roles:UPDATE', '/api/v1/users:READ', '/api/v1/users:UPDATE'];

router.get('/', authorize('/api/v1/roles', 'READ'), asyncHandler(async (req, res) => {
  const [roles] = await db.execute(
    `SELECT r.roleID AS id, r.roleName AS name, r.hierarchyLevel, r.description,
            (SELECT COUNT(*) FROM tbl_user_roles ur WHERE ur.roleID = r.roleID) AS userCount
       FROM tbl_roles r ORDER BY r.hierarchyLevel DESC, r.roleName`);
  const [permissions] = await db.execute(
    `SELECT permissionID AS id, resourceEndpoint AS resource, allowedAction AS action, description FROM tbl_permissions
      ORDER BY resourceEndpoint, FIELD(allowedAction, 'CREATE', 'READ', 'UPDATE', 'DELETE')`);
  const [links] = await db.execute('SELECT roleID, permissionID FROM tbl_role_permissions');
  const matrix = {};
  for (const r of roles) matrix[r.id] = [];
  for (const l of links) (matrix[l.roleID] ||= []).push(l.permissionID);
  res.json({
    roles: roles.map((r) => ({ ...r, userCount: Number(r.userCount), core: CORE_ROLES.includes(r.name) })),
    permissions,
    matrix,
    adminLocked: ADMIN_LOCKED,
  });
}));

router.post('/', authorize('/api/v1/roles', 'CREATE'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = requireString(b.name, 'Role name', { max: 30 });
  if (!/^[A-Za-z][A-Za-z ]{1,29}$/.test(name)) throw new HttpError(400, 'Role name may contain letters and spaces only');
  const level = Number(b.hierarchyLevel ?? 1);
  if (!Number.isInteger(level) || level < 1 || level > 10) throw new HttpError(400, 'Hierarchy level must be 1-10');
  try {
    const [r] = await db.execute('INSERT INTO tbl_roles (roleName, hierarchyLevel, description) VALUES (?, ?, ?)',
      [name, level, optionalString(b.description, 'Description', 255)]);
    res.status(201).json({ id: r.insertId, name });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A role with that name already exists');
    throw e;
  }
}));

// Replace the permission set of one role.
router.put('/:id/permissions', authorize('/api/v1/roles', 'UPDATE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const ids = (req.body || {}).permissionIds;
  if (!Array.isArray(ids)) throw new HttpError(400, 'permissionIds must be a list');
  const wanted = [...new Set(ids.map((x) => toId(x, 'permission id')))];
  const [[role]] = await db.execute('SELECT roleID, roleName FROM tbl_roles WHERE roleID = ?', [id]);
  if (!role) throw new HttpError(404, 'Role not found');

  const [perms] = await db.execute('SELECT permissionID, resourceEndpoint, allowedAction FROM tbl_permissions');
  const byId = new Map(perms.map((p) => [p.permissionID, `${p.resourceEndpoint}:${p.allowedAction}`]));
  for (const pid of wanted) if (!byId.has(pid)) throw new HttpError(400, `Unknown permission ${pid}`);
  if (role.roleName === 'Admin') {
    const keys = new Set(wanted.map((pid) => byId.get(pid)));
    const missing = ADMIN_LOCKED.filter((k) => !keys.has(k));
    if (missing.length) throw new HttpError(400, `The Admin role must keep: ${missing.join(', ')}`);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM tbl_role_permissions WHERE roleID = ?', [id]);
    for (const pid of wanted) await conn.execute('INSERT INTO tbl_role_permissions (roleID, permissionID) VALUES (?, ?)', [id, pid]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ ok: true, count: wanted.length });
}));

router.delete('/:id', authorize('/api/v1/roles', 'DELETE'), asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const [[role]] = await db.execute('SELECT roleName FROM tbl_roles WHERE roleID = ?', [id]);
  if (!role) throw new HttpError(404, 'Role not found');
  if (CORE_ROLES.includes(role.roleName)) throw new HttpError(400, 'The core roles cannot be deleted');
  await db.execute('DELETE FROM tbl_roles WHERE roleID = ?', [id]);
  res.json({ ok: true });
}));

module.exports = router;
