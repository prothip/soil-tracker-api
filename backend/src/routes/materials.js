const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

function getCustomerId(req) {
  return req.user?.customerId || 1;
}

router.get('/', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const materials = db.prepare('SELECT * FROM materials WHERE customer_id = ? ORDER BY name').all(customerId);
  res.json(materials);
});

router.post('/', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required', code: 'MISSING_NAME' });
  try {
    const result = db.prepare('INSERT INTO materials (customer_id, name) VALUES (?, ?)').run(customerId, name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Material already exists', code: 'DUPLICATE_NAME' });
    }
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { id } = req.params;
  const { name } = req.body;
  const info = db.prepare('UPDATE materials SET name = ? WHERE id = ? AND customer_id = ?').run(name, id, customerId);
  if (info.changes === 0) return res.status(404).json({ error: 'Material not found', code: 'NOT_FOUND' });
  res.json({ id: Number(id), name });
});

router.delete('/:id', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { id } = req.params;
  const info = db.prepare('DELETE FROM materials WHERE id = ? AND customer_id = ?').run(id, customerId);
  if (info.changes === 0) return res.status(404).json({ error: 'Material not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

module.exports = router;
