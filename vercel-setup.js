#!/usr/bin/env node
// Prepares a hosted MySQL database (e.g. Aiven) for the Vercel deployment.
//
//   node vercel-setup.js            asks for the database details
//   node vercel-setup.js --reset    wipe the hosted database and reload the demo data
//
// It:
//   1. creates the database, stored procedures, the restricted elearn_app account and
//      the demo data on the hosted server (using its admin account, e.g. avnadmin);
//   2. writes vercel-env.txt with the settings to paste into Vercel. Vercel only
//      receives the restricted app account, never the database admin password.
// Both server/.env.vercel and vercel-env.txt contain secrets and are git-ignored.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const ENV_FILE = path.join(ROOT, 'server', '.env.vercel');
const OUT_FILE = path.join(ROOT, 'vercel-env.txt');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function ask(question, def = '', { secret = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (secret) {
      // Hide typed characters.
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write(s.includes('\n') ? '\n' : '*'); };
    }
    rl.question(`  ${question}${def ? dim(` [${def}]`) : ''}: `, (a) => { rl.close(); resolve(a.trim() || def); });
  });
}

function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function main() {
  console.log(bold('\nSecureLearn: prepare the hosted database for Vercel\n'));
  const prev = readEnvFile(ENV_FILE);
  const reuse = Object.keys(prev).length > 0 && !args.reconfigure;
  let env;

  if (reuse) {
    console.log(`  Using the details saved in server/.env.vercel ${dim('(run with --reconfigure to enter new ones)')}`);
    env = prev;
  } else {
    console.log('  Copy these from the Aiven console: your MySQL service -> Overview -> Connection information.\n');
    const host = args.host || await ask('Host (e.g. mysql-xxxx.aivencloud.com)');
    const port = args.port || await ask('Port', '3306');
    const user = args.user || await ask('User', 'avnadmin');
    const password = args.password !== undefined ? String(args.password) : await ask('Password', '', { secret: true });
    let caFile = args.ca !== undefined ? String(args.ca) : await ask('Path to the downloaded CA certificate (ca.pem), blank for none', 'ca.pem');
    if (caFile) {
      caFile = path.resolve(ROOT, caFile.replace(/^"|"$/g, ''));
      if (!fs.existsSync(caFile)) {
        console.error(red(`\n  CA certificate not found: ${caFile}`));
        console.error('  In the Aiven console click "CA certificate" -> Download, save it as ca.pem in the F4 folder, and run again.\n');
        process.exit(1);
      }
    }
    if (!host || !password) { console.error(red('\n  Host and password are required.\n')); process.exit(1); }
    env = {
      DB_HOST: host,
      DB_PORT: port,
      DB_NAME: args['db-name'] || 'rbac_elearning',
      DB_ROOT_USER: user,
      DB_ROOT_PASSWORD: password,
      DB_USER: 'elearn_app',
      DB_PASSWORD: crypto.randomBytes(18).toString('base64url'),
      DB_SSL_CA_FILE: caFile || '',
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      BCRYPT_COST: '12',
    };
    fs.writeFileSync(ENV_FILE, `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, 'utf8');
    console.log(`\n  ${green('OK')} Saved details to server/.env.vercel (git-ignored)`);
  }

  console.log(`\n${bold('Creating tables, procedures, app account and demo data on the hosted database...')}`);
  const setupArgs = [path.join('db', 'setup.js'), '--env=.env.vercel'];
  if (args.reset) setupArgs.push('--reset');
  const r = spawnSync(process.execPath, setupArgs, { cwd: path.join(ROOT, 'server'), stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(red('\n  The hosted database could not be prepared.'));
    console.error('  Check: the Aiven service is "Running", the host/port/password are right, and the CA certificate is the one for this service.');
    console.error('  Run again with --reconfigure to re-enter the details.\n');
    process.exit(1);
  }

  // Settings for Vercel: the restricted app account only.
  const ca = env.DB_SSL_CA_FILE ? fs.readFileSync(env.DB_SSL_CA_FILE) : null;
  const vercelEnv = {
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_NAME: env.DB_NAME,
    DB_USER: env.DB_USER,
    DB_PASSWORD: env.DB_PASSWORD,
    ...(ca ? { DB_SSL_CA: ca.toString('base64') } : { DB_SSL: 'true' }),
    JWT_SECRET: env.JWT_SECRET,
    JWT_EXPIRES_IN: '30m',
    BCRYPT_COST: env.BCRYPT_COST || '12',
    NODE_ENV: 'production',
  };
  fs.writeFileSync(OUT_FILE, `${Object.entries(vercelEnv).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, 'utf8');

  console.log(`\n${green(bold('Hosted database ready.'))}`);
  console.log(`\n  Vercel settings written to ${bold('vercel-env.txt')} (git-ignored, contains secrets).`);
  console.log('  Next: in Vercel -> your project -> Settings -> Environment Variables,');
  console.log('  click in the Key field and paste the whole contents of vercel-env.txt, then Save and redeploy.');
  console.log(dim('  Full steps: VERCEL_DEPLOY.md\n'));
}

main().catch((e) => { console.error(red(`\n  ${e.message}\n`)); process.exit(1); });
