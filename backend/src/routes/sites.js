const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get customer_id from user (either from JWT or device token)
function getCustomerId(req) {
  return req.user?.customerId || 1;
}

router.get('/', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const sites = db.prepare('SELECT * FROM sites WHERE customer_id = ? ORDER BY name').all(customerId);
  res.json(sites);
});

router.post('/', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required', code: 'MISSING_NAME' });
  const result = db.prepare('INSERT INTO sites (customer_id, name, location) VALUES (?, ?, ?)').run(customerId, name, location || '');
  res.status(201).json({ id: result.lastInsertRowid, name, location });
});

router.put('/:id', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { id } = req.params;
  const { name, location } = req.body;
  const info = db.prepare('UPDATE sites SET name = ?, location = ? WHERE id = ? AND customer_id = ?').run(name, location || '', id, customerId);
  if (info.changes === 0) return res.status(404).json({ error: 'Site not found', code: 'NOT_FOUND' });
  res.json({ id: Number(id), name, location });
});

router.delete('/:id', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { id } = req.params;
  const info = db.prepare('DELETE FROM sites WHERE id = ? AND customer_id = ?').run(id, customerId);
  if (info.changes === 0) return res.status(404).json({ error: 'Site not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

module.exports = router;
