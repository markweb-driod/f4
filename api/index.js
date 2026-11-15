// Vercel serverless entry point. vercel.json rewrites every /api/* request here; the
// Express app handles routing exactly as it does on a normal server.
module.exports = require('../server/src/app');
