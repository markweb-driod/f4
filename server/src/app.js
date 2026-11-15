const path = require('path');
const fs = require('fs');
const env = require('./config/env');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { HttpError } = require('./utils/http');

const app = express();
app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', 1);

// HTTP security headers (helmet) with a strict Content Security Policy.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      // Only when this server itself terminates TLS (behind an HTTPS proxy, set it there).
      upgradeInsecureRequests: env.tlsCert ? [] : null,
    },
  },
  strictTransportSecurity: !!env.tlsCert,
}));
app.use(express.json({ limit: '1mb' }));

// General API rate limit, plus a tighter one on the login endpoint (brute-force defence
// that complements the per-account lockout).
if (!env.isTest) {
  app.use('/api/', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/v1/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Too many login attempts from this address. Try again later.' },
  }));
}

// API responses must never be cached by browsers or proxies.
app.use('/api/', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/v1/health', (req, res) => res.json({ ok: true }));
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/profile', require('./routes/profile'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/roles', require('./routes/roles'));
app.use('/api/v1/courses', require('./routes/courses'));
app.use('/api/v1/grades', require('./routes/grades'));
app.use('/api/v1/audit-logs', require('./routes/audit'));
app.use('/api/v1', require('./routes/materials'));
app.use('/api/v1', require('./routes/assignments'));

app.use('/api/', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React client when present (production / docker).
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.type('text').send('SecureLearn API is running, but the web interface has not been built.\nRun setup.bat (or: npm run setup), or run "npm run build" in the client folder, then restart.'));
}

// Central error handler. Database errors raised by the RBAC stored procedures
// (SQLSTATE 45000) are turned into clean 403/409 responses.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err && err.sqlState === '45000') {
    const msg = String(err.sqlMessage || err.message);
    const status = msg.startsWith('RBAC:') ? 403 : msg.startsWith('Separation of Duty') ? 409 : 400;
    return res.status(status).json({ error: msg.replace(/^RBAC:\s*/, '') });
  }
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
