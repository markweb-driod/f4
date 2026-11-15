// Writes db/rbac_elearning.sql: the complete database (schema, stored procedures,
// application account and demo data) as one file that can be imported with phpMyAdmin
// or the mysql command line. Run with: npm run db:export
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { TABLES, PROCEDURES } = require('./schema');
const { buildSeedStatements } = require('./seed-sql');
const { appAccountStatements } = require('./setup');

const DB = 'rbac_elearning';
const APP_USER = 'elearn_app';
const APP_PASSWORD = 'ChangeMe_App_2026!';

async function main() {
  const seed = await buildSeedStatements((pw) => bcrypt.hash(pw, 12));
  const lines = [
    '-- =====================================================================',
    '-- SecureLearn: secure e-learning system using role-based access control',
    '-- Complete database: schema, stored procedures, app account and demo data.',
    '-- Works with MySQL 8.0+ and MariaDB 10.4+ (XAMPP).',
    '--',
    '-- Import with phpMyAdmin (Import tab, no database selected) or:',
    '--     mysql -u root -p < rbac_elearning.sql',
    '--',
    `-- WARNING: this DROPS and recreates the \`${DB}\` database.`,
    '--',
    `-- It also creates the MySQL account '${APP_USER}' with the password`,
    `-- '${APP_PASSWORD}'. Put the same value in server/.env as DB_PASSWORD,`,
    '-- and change both before real use (see SETUP_GUIDE.md).',
    '--',
    '-- Demo sign-in passwords: Admin@12345, Lecturer@123, Student@123,',
    '-- Assist@123 (see SETUP_GUIDE.md for the account list).',
    `-- Generated ${new Date().toISOString().slice(0, 10)} by server/db/export-sql.js - do not edit by hand.`,
    '-- =====================================================================',
    '',
    "SET time_zone = '+00:00';",
    'SET NAMES utf8mb4;',
    '',
    `DROP DATABASE IF EXISTS \`${DB}\`;`,
    `CREATE DATABASE \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `USE \`${DB}\`;`,
    '',
    '-- ---------------------------------------------------------------------',
    '-- Tables',
    '-- ---------------------------------------------------------------------',
    ...TABLES.map((t) => `${t.replace(/\n {3}/g, '\n')};\n`),
    '-- ---------------------------------------------------------------------',
    '-- Stored procedures (role checks and Separation of Duty in the database)',
    '-- ---------------------------------------------------------------------',
    'DELIMITER $$',
    ...PROCEDURES.map((p) => `${p.replace(/\n {3}/g, '\n')}$$\n`),
    'DELIMITER ;',
    '',
    '-- ---------------------------------------------------------------------',
    '-- Least-privilege application account',
    '-- ---------------------------------------------------------------------',
    ...appAccountStatements(DB, APP_USER, `'${APP_PASSWORD}'`).map((s) => `${s};`),
    '',
    '-- ---------------------------------------------------------------------',
    '-- Demo data',
    '-- ---------------------------------------------------------------------',
    'START TRANSACTION;',
    ...seed.map((s) => (s.startsWith('--') ? `\n${s}` : `${s};`)),
    'COMMIT;',
    '',
  ];
  const file = path.join(__dirname, 'rbac_elearning.sql');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
