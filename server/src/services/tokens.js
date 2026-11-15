const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Signed JSON Web Token carrying the user's identity and the single role activated
// for this session (Section 3.4.1, 4.4.2). `tv` is the account's token version: bumping
// it in the database (logout, suspension, password change) invalidates older tokens.
function issueToken(user, roleName) {
  return jwt.sign(
    { sub: String(user.userID), role: roleName, name: user.fullName, username: user.username, tv: user.tokenVersion },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: env.jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

module.exports = { issueToken, verifyToken, bearer };
