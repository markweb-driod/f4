const env = require('./env');
const mysql = require('mysql2/promise');
const { dbSsl } = require('./ssl');

// Connection pool for the least-privilege application account.
// All queries use placeholders (parameterised statements) to prevent SQL injection.
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'elearn_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rbac_elearning',
  ssl: dbSsl(),
  waitForConnections: true,
  // Serverless instances each hold their own pool; keep them small so a free-tier
  // hosted database does not run out of connections.
  connectionLimit: env.onVercel ? 2 : 10,
  maxIdle: env.onVercel ? 1 : 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  dateStrings: false,
  timezone: 'Z',
});

// Keep every timestamp in UTC so NOW()/CURRENT_TIMESTAMP match JavaScript dates.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

module.exports = pool;
