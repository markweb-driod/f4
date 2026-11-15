// Unit tests for individual functions (Section 4.6.1).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validatePassword, toId } = require('../src/utils/http');
const { issueToken, verifyToken, bearer } = require('../src/services/tokens');
const db = require('../src/config/db');

afterAll(() => db.end());

describe('password hashing', () => {
  test('bcrypt hash verifies the right password only and is salted', async () => {
    const h1 = await bcrypt.hash('Secret@123', 4);
    const h2 = await bcrypt.hash('Secret@123', 4);
    expect(h1).not.toBe(h2);
    expect(await bcrypt.compare('Secret@123', h1)).toBe(true);
    expect(await bcrypt.compare('secret@123', h1)).toBe(false);
  });

  test('password policy', () => {
    expect(() => validatePassword('Strong@123')).not.toThrow();
    for (const bad of ['short1!', 'alllowercase1!', 'ALLUPPER1!', 'NoDigits!!', 'NoSymbol123', undefined, 'A1!a'.repeat(20)]) {
      expect(() => validatePassword(bad)).toThrow();
    }
  });
});

describe('tokens', () => {
  const user = { userID: 7, username: 'u@x', fullName: 'U', tokenVersion: 3 };

  test('issued token carries identity, active role and a 30-minute expiry', () => {
    const t = issueToken(user, 'Student');
    const c = verifyToken(t);
    expect(c).toMatchObject({ sub: '7', role: 'Student', tv: 3 });
    expect(c.exp - c.iat).toBe(30 * 60);
    expect(jwt.decode(t, { complete: true }).header.alg).toBe('HS256');
  });

  test('tampered tokens fail verification', () => {
    const t = issueToken(user, 'Student');
    const [h, , s] = t.split('.');
    const p = Buffer.from(JSON.stringify({ sub: '7', role: 'Admin', tv: 3 })).toString('base64url');
    expect(() => verifyToken(`${h}.${p}.${s}`)).toThrow();
  });

  test('bearer header parsing', () => {
    expect(bearer({ headers: { authorization: 'Bearer abc' } })).toBe('abc');
    expect(bearer({ headers: { authorization: 'Basic abc' } })).toBeNull();
    expect(bearer({ headers: {} })).toBeNull();
  });
});

describe('input validation', () => {
  test('ids must be positive integers', () => {
    expect(toId('12')).toBe(12);
    for (const bad of ['0', '-1', '1.5', 'abc', '1 OR 1=1', undefined]) expect(() => toId(bad)).toThrow();
  });
});

describe('permission lookup', () => {
  test('the seeded matrix follows Table 4.4', async () => {
    const q = async (role, res, act) => {
      const [r] = await db.execute(
        `SELECT 1 FROM tbl_role_permissions rp JOIN tbl_roles r ON r.roleID = rp.roleID JOIN tbl_permissions p ON p.permissionID = rp.permissionID
          WHERE r.roleName = ? AND p.resourceEndpoint = ? AND p.allowedAction = ?`, [role, res, act]);
      return r.length > 0;
    };
    expect(await q('Admin', '/api/v1/audit-logs', 'READ')).toBe(true);
    expect(await q('Lecturer', '/api/v1/audit-logs', 'READ')).toBe(false);
    expect(await q('Student', '/api/v1/submissions', 'CREATE')).toBe(true);
    expect(await q('Lecturer', '/api/v1/submissions', 'CREATE')).toBe(false);
    expect(await q('Lecturer', '/api/v1/grades/submit', 'CREATE')).toBe(true);
    expect(await q('Admin', '/api/v1/grades/submit', 'CREATE')).toBe(false);
    expect(await q('Student', '/api/v1/grades', 'UPDATE')).toBe(false);
    expect(await q('Student', '/api/v1/users', 'READ')).toBe(false);
  });
});
