// TLS settings for the MySQL connection. Hosted databases such as Aiven require an
// encrypted connection verified against the provider's CA certificate.
//   DB_SSL=true            encrypt and verify against the system's trusted CAs
//   DB_SSL_CA=<PEM text>   provider CA certificate (newlines may be written as \n), or base64 of it
//   DB_SSL_CA_FILE=path    provider CA certificate file
const fs = require('fs');
const path = require('path');

function readCa() {
  if (process.env.DB_SSL_CA_FILE) {
    const p = path.resolve(path.join(__dirname, '..', '..'), process.env.DB_SSL_CA_FILE);
    return fs.readFileSync(p, 'utf8');
  }
  const raw = (process.env.DB_SSL_CA || '').trim();
  if (!raw) return null;
  if (raw.includes('BEGIN CERTIFICATE')) return raw.replace(/\\n/g, '\n');
  return Buffer.from(raw, 'base64').toString('utf8');
}

function dbSsl() {
  const ca = readCa();
  if (ca) return { ca, rejectUnauthorized: true };
  if (/^(1|true|required)$/i.test(process.env.DB_SSL || '')) return { rejectUnauthorized: true };
  return undefined;
}

module.exports = { dbSsl };
