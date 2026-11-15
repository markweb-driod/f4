const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters (see .env.example)');
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  isTest: process.env.NODE_ENV === 'test',
  isProd: process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30m',
  bcryptCost: Number(process.env.BCRYPT_COST || 12),
  maxFailedLogins: 5,
  lockMinutes: 15,
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')),
  trustProxy: process.env.TRUST_PROXY === '1',
  tlsCert: process.env.TLS_CERT || '',
  tlsKey: process.env.TLS_KEY || '',
};
