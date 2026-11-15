#!/usr/bin/env node
// SecureLearn one-step installer. Works on Windows, macOS and Linux.
//
//   node setup.js                 interactive setup (asks for the MySQL root password)
//   node setup.js --yes           accept defaults without asking (root user, empty password)
//   node setup.js --reset-db      wipe the database and reload the demo data
//
// Other options: --db-host=127.0.0.1 --db-port=3306 --db-root-user=root --db-root-password=secret
//                --port=4000 --skip-install --skip-build
//
// Steps: check Node.js -> install packages -> write server/.env -> create database and
// demo data -> build the web client.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server');
const CLIENT = path.join(ROOT, 'client');
const ENV_FILE = path.join(SERVER, '.env');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const interactive = !args.yes && process.stdin.isTTY;

const c = { bold: (s) => `\x1b[1m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` };
let stepNo = 0;
const step = (title) => console.log(`\n${c.bold(`[${++stepNo}/5] ${title}`)}`);
const ok = (msg) => console.log(`  ${c.green('OK')} ${msg}`);
function fail(msg, help) {
  console.error(`\n  ${c.red('FAILED')} ${msg}`);
  if (help) console.error(`\n${help.split('\n').map((l) => `  ${l}`).join('\n')}`);
  console.error(`\n  See ${c.bold('SETUP_GUIDE.md')} -> Troubleshooting.\n`);
  process.exit(1);
}

function ask(question, def = '') {
  if (!interactive) return Promise.resolve(def);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(`  ${question}${def ? c.dim(` [${def}]`) : ''}: `, (a) => { rl.close(); resolve(a.trim() || def); }));
}

// Runs npm. On Windows npm is a .cmd script, so it needs a shell; the arguments are fixed
// strings from this file, never user input.
function run(cmd, cmdArgs, cwd) {
  const r = process.platform === 'win32'
    ? spawnSync([cmd, ...cmdArgs].join(' '), { cwd, stdio: 'inherit', shell: true })
    : spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  return r.status === 0;
}

function readEnv() {
  if (!fs.existsSync(ENV_FILE)) return null;
  const env = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function writeEnv(values) {
  const template = fs.readFileSync(path.join(SERVER, '.env.example'), 'utf8');
  const out = template.split(/\r?\n/).map((line) => {
    const m = /^([A-Z0-9_]+)=/.exec(line);
    return m && values[m[1]] !== undefined ? `${m[1]}=${values[m[1]]}` : line;
  }).join('\n');
  fs.writeFileSync(ENV_FILE, out, 'utf8');
}

async function main() {
  console.log(c.bold('\nSecureLearn setup'));
  console.log(c.dim('Secure e-learning system using role-based access control\n'));

  // 1. Node.js version
  step('Checking Node.js');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    fail(`Node.js ${process.versions.node} is too old.`, 'Install Node.js 20 or 22 LTS from https://nodejs.org and run setup again.');
  }
  ok(`Node.js ${process.versions.node}`);

  // 2. Packages
  step('Installing packages (first run downloads ~100 MB, please wait)');
  if (args['skip-install']) {
    console.log(c.dim('  skipped (--skip-install)'));
  } else {
    for (const [name, dir] of [['server', SERVER], ['client', CLIENT]]) {
      console.log(c.dim(`  npm install in ${name}/ ...`));
      if (!run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], dir)) {
        fail(`npm install failed in ${name}/.`, 'Check your internet connection, then run setup again.\nBehind a proxy? Run: npm config set proxy http://your-proxy:port');
      }
    }
    ok('Packages installed');
  }

  // 3. Configuration
  step('Configuring server/.env');
  let env = readEnv();
  if (env && !args['reconfigure']) {
    ok('Using existing server/.env (run with --reconfigure to create a new one)');
    if (args['db-root-password'] !== undefined) env.DB_ROOT_PASSWORD = args['db-root-password'];
  } else {
    console.log('  Enter your MySQL / MariaDB details. Press Enter to accept the default shown in [brackets].');
    console.log(c.dim('  With a fresh XAMPP install the root password is empty: just press Enter.'));
    const host = args['db-host'] || await ask('Database host', '127.0.0.1');
    const port = args['db-port'] || await ask('Database port', '3306');
    const rootUser = args['db-root-user'] || await ask('Database admin user', 'root');
    const rootPassword = args['db-root-password'] !== undefined ? String(args['db-root-password']) : await ask('Database admin password (blank for XAMPP)', '');
    const appPort = args.port || await ask('Web server port', '4000');
    env = {
      PORT: appPort,
      NODE_ENV: 'production',
      DB_HOST: host,
      DB_PORT: port,
      DB_NAME: 'rbac_elearning',
      DB_ROOT_USER: rootUser,
      DB_ROOT_PASSWORD: rootPassword,
      DB_USER: 'elearn_app',
      DB_PASSWORD: crypto.randomBytes(18).toString('base64url'),
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      JWT_EXPIRES_IN: '30m',
      BCRYPT_COST: '12',
    };
    writeEnv(env);
    ok('Created server/.env with freshly generated secrets');
  }

  // 4. Database
  step('Creating the database and loading demo data');
  for (const k of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_ROOT_USER', 'DB_ROOT_PASSWORD', 'DB_USER', 'DB_PASSWORD', 'BCRYPT_COST']) {
    if (env[k] !== undefined) process.env[k] = env[k];
  }
  let setup;
  try {
    ({ setup } = require(path.join(SERVER, 'db', 'setup.js')));
  } catch (e) {
    fail('Server packages are missing.', 'Run setup again without --skip-install.');
  }
  try {
    await setup({ reset: !!args['reset-db'] });
    ok('Database rbac_elearning is ready');
  } catch (e) {
    const where = `${env.DB_HOST}:${env.DB_PORT}`;
    if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code === 'ENOTFOUND') {
      fail(`Cannot reach MySQL/MariaDB at ${where}.`, 'Start MySQL first:\n  - XAMPP: open the XAMPP Control Panel and click Start next to MySQL.\n  - macOS (Homebrew): brew services start mysql\n  - Linux: sudo systemctl start mariadb   (or mysql)\nThen run setup again.');
    }
    if (e.code === 'ER_ACCESS_DENIED_ERROR' || e.code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') {
      fail(`MySQL refused the password for user "${env.DB_ROOT_USER}".`, 'Run setup again with the right password, for example:\n  node setup.js --reconfigure\nor edit DB_ROOT_PASSWORD in server/.env.');
    }
    fail(`Database setup failed: ${e.message}`);
  }

  // 5. Client build
  step('Building the web interface');
  if (args['skip-build']) {
    console.log(c.dim('  skipped (--skip-build)'));
  } else if (!run('npm', ['run', 'build', '--silent'], CLIENT)) {
    fail('The web interface could not be built.', 'Run setup again. If it keeps failing, delete client/node_modules and retry.');
  } else {
    ok('Web interface built (client/dist)');
  }

  const port = env.PORT || '4000';
  console.log(`\n${c.green(c.bold('Setup complete.'))}\n`);
  console.log(`  Start the system:   ${c.bold(process.platform === 'win32' ? 'double-click start.bat' : 'npm start')}   ${c.dim('(or: npm start)')}`);
  console.log(`  Then open:          ${c.bold(`http://localhost:${port}`)}\n`);
  console.log('  Demo sign-in accounts (test values - change before real use):');
  console.log('    Admin      admin@nsuk.edu.ng             Admin@12345');
  console.log('    Lecturer   n.ajumobi@nsuk.edu.ng         Lecturer@123');
  console.log('    Student    peace.o@student.nsuk.edu.ng   Student@123');
  console.log('    Both roles ta.john@nsuk.edu.ng           Assist@123');
  console.log(c.dim('\n  Full list and a guided tour: SETUP_GUIDE.md\n'));
}

main().catch((e) => fail(e.message));
