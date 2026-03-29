const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'soil-tracker-secret-key-2026';

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'ADMIN_REQUIRED' });
  }
  next();
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  let token = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
  }

  // Raw device IDs from offline activation (e.g. "3a9f...") — 32 hex chars
  // These are valid without JWT verification
  if (/^[a-f0-9]{32}$/i.test(token)) {
    req.user = { type: 'device', role: 'user' };
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };
