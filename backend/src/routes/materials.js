const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = require('../db/database');
  const materials = db.prepare('SELECT * FROM materials ORDER BY name').all();
  res.json(materials);
});

router.post('/', (req, res) => {
  const db = require('../db/database');
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required', code: 'MISSING_NAME' });
  try {
    const result = db.prepare('INSERT INTO materials (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Material already exists', code: 'DUPLICATE' });
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const db = require('../db/database');
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required', code: 'MISSING_NAME' });
  const info = db.prepare('UPDATE materials SET name = ? WHERE id = ?').run(name, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Material not found', code: 'NOT_FOUND' });
  res.json({ id: Number(id), name });
});

router.delete('/:id', (req, res) => {
  const db = require('../db/database');
  const info = db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Material not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

module.exports = router;
