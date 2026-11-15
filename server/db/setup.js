// Creates the database, tables, stored procedures, the restricted application account
// and the demo data. Usage:
//   node db/setup.js            create anything missing and load demo data into an empty database
//   node db/setup.js --reset    drop and recreate the database (destroys all data)
//   node db/setup.js --env=.env.vercel   use another settings file (e.g. a hosted database)
//
// Connects with DB_ROOT_USER / DB_ROOT_PASSWORD (an account allowed to create databases,
// users and procedures). The app itself then runs as DB_USER, which only receives the
// limited grants in TABLE_GRANTS.

const path = require('path');
const envArg = process.argv.find((a) => a.startsWith('--env='));
require('dotenv').config({ path: path.resolve(path.join(__dirname, '..'), envArg ? envArg.slice(6) : '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { TABLES, PROCEDURES, TABLE_GRANTS, COLUMN_UPGRADES } = require('./schema');
const { buildSeedStatements, isComment } = require('./seed-sql');
const { dbSsl } = require('../src/config/ssl');

function config() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    rootUser: process.env.DB_ROOT_USER || 'root',
    rootPassword: process.env.DB_ROOT_PASSWORD || '',
    appUser: process.env.DB_USER || 'elearn_app',
    appPassword: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rbac_elearning',
    cost: Number(process.env.BCRYPT_COST || 12),
  };
}

const ident = (s) => '`' + String(s).replace(/`/g, '``') + '`';
const account = (user, host) => `'${String(user).replace(/'/g, "''")}'@'${host}'`;
const APP_HOSTS = ['localhost', '127.0.0.1', '%'];

// Statements that create the restricted application account (also used by export-sql.js).
function appAccountStatements(database, user, passwordSql) {
  const out = [];
  for (const host of APP_HOSTS) {
    const acc = account(user, host);
    out.push(`CREATE USER IF NOT EXISTS ${acc} IDENTIFIED BY ${passwordSql}`);
    out.push(`ALTER USER ${acc} IDENTIFIED BY ${passwordSql}`);
    for (const [table, privs] of Object.entries(TABLE_GRANTS)) out.push(`GRANT ${privs} ON ${ident(database)}.${ident(table)} TO ${acc}`);
    out.push(`GRANT EXECUTE ON ${ident(database)}.* TO ${acc}`);
  }
  return out;
}

async function setup({ reset = false, quiet = false } = {}) {
  const c = config();
  const log = quiet ? () => {} : (...a) => console.log(...a);
  const conn = await mysql.createConnection({
    host: c.host, port: c.port, user: c.rootUser, password: c.rootPassword, timezone: 'Z', ssl: dbSsl(), connectTimeout: 20000,
  });
  try {
    await conn.query("SET time_zone = '+00:00'");
    if (reset) {
      await conn.query(`DROP DATABASE IF EXISTS ${ident(c.database)}`);
      log(`  Dropped database ${c.database}`);
    }
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${ident(c.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE ${ident(c.database)}`);

    for (const sql of TABLES) await conn.query(sql);
    for (const [table, column, definition] of COLUMN_UPGRADES) {
      const [found] = await conn.query(
        'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [c.database, table, column]);
      if (!found.length) {
        await conn.query(`ALTER TABLE ${ident(table)} ADD COLUMN ${ident(column)} ${definition}`);
        log(`  Upgraded ${table}: added ${column}`);
      }
    }
    for (const sql of PROCEDURES) await conn.query(sql);
    log('  Tables and stored procedures ready');

    // Restricted application account (database-level isolation, Section 3.4.1).
    if (c.appUser !== c.rootUser) {
      for (const sql of appAccountStatements(c.database, c.appUser, mysql.escape(c.appPassword))) await conn.query(sql);
      log(`  Application account '${c.appUser}' granted least-privilege access`);
    }

    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM tbl_roles');
    if (n > 0) {
      log('  Database already contains data - demo data not loaded (use --reset to start again)');
      return { seeded: false };
    }
    log('  Loading demo data (hashing demo passwords, this takes a few seconds)...');
    const statements = await buildSeedStatements((pw) => bcrypt.hash(pw, c.cost));
    await conn.beginTransaction();
    try {
      for (const sql of statements) if (!isComment(sql)) await conn.query(sql);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }
    const [[counts]] = await conn.query(
      `SELECT (SELECT COUNT(*) FROM tbl_users) AS users, (SELECT COUNT(*) FROM tbl_courses) AS courses,
              (SELECT COUNT(*) FROM tbl_assignments) AS assignments, (SELECT COUNT(*) FROM tbl_submissions) AS submissions,
              (SELECT COUNT(*) FROM tbl_grades) AS grades`);
    log(`  Demo data loaded: ${counts.users} users, ${counts.courses} courses, ${counts.assignments} assignments, ${counts.submissions} submissions, ${counts.grades} grades`);
    return { seeded: true };
  } finally {
    await conn.end();
  }
}

module.exports = { setup, appAccountStatements, config };

if (require.main === module) {
  setup({ reset: process.argv.includes('--reset') })
    .then(() => process.exit(0))
    .catch((err) => { console.error('Database setup failed:', err.message); process.exit(1); });
}
