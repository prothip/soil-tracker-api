const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = require('../db/database');
  const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
  res.json(sites);
});

router.post('/', (req, res) => {
  const db = require('../db/database');
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required', code: 'MISSING_NAME' });
  const result = db.prepare('INSERT INTO sites (name, location) VALUES (?, ?)').run(name, location || '');
  res.status(201).json({ id: result.lastInsertRowid, name, location });
});

router.put('/:id', (req, res) => {
  const db = require('../db/database');
  const { id } = req.params;
  const { name, location } = req.body;
  const info = db.prepare('UPDATE sites SET name = ?, location = ? WHERE id = ?').run(name, location || '', id);
  if (info.changes === 0) return res.status(404).json({ error: 'Site not found', code: 'NOT_FOUND' });
  res.json({ id: Number(id), name, location });
});

router.delete('/:id', (req, res) => {
  const db = require('../db/database');
  const { id } = req.params;
  const info = db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Site not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

module.exports = router;
