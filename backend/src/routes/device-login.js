const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const db = require('../db/database');

// POST /api/auth/device-login — validate activation code, return STP device token
router.post('/device-login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Activation code required' });

  const normalized = code.trim().toUpperCase();
  const record = db.prepare('SELECT * FROM codes WHERE code = ?').get(normalized);

  if (!record) return res.status(401).json({ error: 'Invalid activation code' });
  if (record.status === 'deactivated') return res.status(401).json({ error: 'Code has been deactivated' });
  if (record.expires_at && new Date(record.expires_at) < new Date()) return res.status(401).json({ error: 'Code has expired' });
  if (record.max_uses > 0 && record.use_count >= record.max_uses) return res.status(401).json({ error: 'Code has reached its usage limit' });

  // Increment use count
  db.prepare('UPDATE codes SET use_count = use_count + 1 WHERE id = ?').run(record.id);
  if (record.max_uses > 0 && record.use_count + 1 >= record.max_uses) {
    db.prepare("UPDATE codes SET status = 'used' WHERE id = ?").run(record.id);
  }

  const deviceToken = jwt.sign(
    { type: 'device', code: normalized },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token: deviceToken, message: 'Activated successfully' });
});

module.exports = router;
