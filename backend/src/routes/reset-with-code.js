const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// POST /api/auth/verify-code — check if an activation code is valid (uses activation-gen)
router.post('/verify-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    // Validate against activation-gen
    const response = await fetch('http://localhost:3003/api/codes/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() })
    });
    const result = await response.json();
    if (!result.valid) return res.status(400).json({ error: 'Invalid activation code', valid: false });

    res.json({ valid: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error', valid: false });
  }
});

// POST /api/auth/reset-with-code — reset credentials using activation code
router.post('/reset-with-code', async (req, res) => {
  try {
    const { code, username, password } = req.body;

    if (!code || !username || !password) {
      return res.status(400).json({ error: 'Code, username, and password required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // Validate against activation-gen
    let valid = false;
    try {
      const response = await fetch('http://localhost:3003/api/codes/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      });
      const result = await response.json();
      valid = result.valid;
    } catch (err) {
      return res.status(503).json({ error: 'Cannot reach activation server' });
    }

    if (!valid) {
      return res.status(401).json({ error: 'Invalid activation code' });
    }

    // Code is valid — update credentials in STP DB
    const db = require('../db/database');
    const hash = bcrypt.hashSync(password, 10);

    // Check existing users
    const users = db.prepare('SELECT id FROM users').all();
    if (users.length === 0) {
      db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'admin');
    } else {
      // Update the admin user (first one found)
      db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, hash, users[0].id);
    }

    res.json({ success: true, message: 'Credentials updated successfully' });
  } catch (err) {
    console.error('reset-with-code error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
