const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const db = require('../db/database');
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials', code: 'BAD_CREDENTIALS' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get('/me', require('../middleware/auth').authMiddleware, (req, res) => {
  const db = require('../db/database');
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.put('/password', require('../middleware/auth').authMiddleware, async (req, res) => {
  const db = require('../db/database');
  const { currentPassword, newUsername, newPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required', code: 'MISSING_CURRENT_PASSWORD' });
  }

  if (!newUsername && !newPassword) {
    return res.status(400).json({ error: 'Provide new username and/or new password', code: 'NOTHING_TO_CHANGE' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect', code: 'BAD_CURRENT_PASSWORD' });
  }

  if (newUsername && newUsername !== user.username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, user.id);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
    }
  }

  const updates = [];
  const params = [];

  if (newUsername && newUsername !== user.username) {
    updates.push('username = ?');
    params.push(newUsername);
  }

  if (newPassword) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(newPassword, 10));
  }

  if (updates.length > 0) {
    params.push(user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json({ success: true });
});

router.post('/users', require('../middleware/auth').authMiddleware, (req, res) => {
  const db = require('../db/database');
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role || 'user');
  res.json({ success: true, id: result.lastInsertRowid, username, role: role || 'user' });
});

module.exports = router;
