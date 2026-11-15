class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Wraps an async route handler so rejected promises reach the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function toId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}`);
  return n;
}

function requireString(value, name, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') throw new HttpError(400, `${name} is required`);
  const v = value.trim();
  if (v.length < min) throw new HttpError(400, `${name} is required`);
  if (v.length > max) throw new HttpError(400, `${name} must be at most ${max} characters`);
  return v;
}

function optionalString(value, name, max = 5000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be text`);
  if (value.length > max) throw new HttpError(400, `${name} must be at most ${max} characters`);
  return value.trim();
}

// Password policy: users are expected to choose strong passwords (Section 1.6).
function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) {
    throw new HttpError(400, 'Password must be 8-72 characters long');
  }
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
    throw new HttpError(400, 'Password must contain upper and lower case letters, a number and a symbol');
  }
  return pw;
}

module.exports = { HttpError, asyncHandler, toId, requireString, optionalString, validatePassword };
