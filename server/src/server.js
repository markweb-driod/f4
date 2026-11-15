const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const env = require('./config/env');
const db = require('./config/db');
const app = require('./app');

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

async function start() {
  // Fail early with a clear message if the database is not reachable.
  try {
    await db.query('SELECT 1 FROM tbl_roles LIMIT 1');
  } catch (e) {
    console.error('\nCannot use the database:', e.code || '', e.message);
    if (e.code === 'ECONNREFUSED') console.error('-> Start MySQL/MariaDB (XAMPP Control Panel -> MySQL -> Start), then start SecureLearn again.');
    else if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('-> DB_USER / DB_PASSWORD in server/.env do not match the database. Run the setup again.');
    else if (e.code === 'ER_BAD_DB_ERROR' || e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_TABLEACCESS_DENIED_ERROR') console.error('-> The database has not been created. Run setup.bat (or: npm run setup).');
    console.error('');
    process.exit(1);
  }

  const server = env.tlsCert && env.tlsKey
    ? https.createServer({ cert: fs.readFileSync(env.tlsCert), key: fs.readFileSync(env.tlsKey) }, app)
    : http.createServer(app);

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`\nPort ${env.port} is already in use. Close the other program or set PORT in server/.env to another number (e.g. 4100).\n`);
    else console.error(e);
    process.exit(1);
  });

  server.listen(env.port, () => {
    const scheme = env.tlsCert ? 'https' : 'http';
    console.log('\nSecureLearn is running.');
    console.log(`  On this computer:      ${scheme}://localhost:${env.port}`);
    for (const ip of lanAddresses()) console.log(`  On your local network: ${scheme}://${ip}:${env.port}`);
    console.log('\nPress Ctrl+C to stop.\n');
  });
}

start();
