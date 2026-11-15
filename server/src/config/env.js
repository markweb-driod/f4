const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters (see .env.example)');
}

// Running as a Vercel serverless function: read-only disk, behind Vercel's proxy,
// request bodies limited to 4.5 MB.
const onVercel = !!process.env.VERCEL;
const fileStorage = (process.env.FILE_STORAGE || (onVercel ? 'database' : 'disk')).toLowerCase();
if (!['disk', 'database'].includes(fileStorage)) throw new Error('FILE_STORAGE must be "disk" or "database"');

module.exports = {
  port: Number(process.env.PORT || 4000),
  isTest: process.env.NODE_ENV === 'test',
  isProd: process.env.NODE_ENV === 'production',
  onVercel,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30m',
  bcryptCost: Number(process.env.BCRYPT_COST || 12),
  maxFailedLogins: 5,
  lockMinutes: 15,
  // Where uploaded materials / submissions are kept: "disk" (uploads folder) or "database".
  fileStorage,
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || (onVercel ? 4 : 10)),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')),
  trustProxy: process.env.TRUST_PROXY === '1' || onVercel,
  tlsCert: process.env.TLS_CERT || '',
  tlsKey: process.env.TLS_KEY || '',
};
