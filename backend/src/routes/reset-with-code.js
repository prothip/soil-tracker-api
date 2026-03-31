const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db/database');

// POST /api/reset-with-code — reset admin password using activation code
// Body: { code: "STP-XXXXXX" }
router.post('/', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const normalized = code.trim().toUpperCase();

  // Check if code exists and is active in our codes table
  const codeRow = db.prepare('SELECT * FROM codes WHERE code = ?').get(normalized);
  if (codeRow && codeRow.status === 'active') {
    // Valid code — reset admin password to admin123
    const hash = bcrypt.hashSync('admin123', 10);
    const users = db.prepare('SELECT id FROM users').all();
    if (users.length === 0) {
      db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    } else {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, users[0].id);
    }
    return res.json({ success: true });
  }

  // Not found in local codes — try legacy offline_activations
  const legacy = db.prepare("SELECT * FROM offline_activations WHERE code = ? AND status = 'active'").get(normalized);
  if (legacy) {
    const hash = bcrypt.hashSync('admin123', 10);
    const users = db.prepare('SELECT id FROM users').all();
    if (users.length === 0) {
      db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    } else {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, users[0].id);
    }
    return res.json({ success: true });
  }

  res.status(401).json({ error: 'Invalid or expired activation code' });
});

module.exports = router;
