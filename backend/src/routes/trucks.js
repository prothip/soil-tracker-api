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
  const status = req.query.status;
  let query = 'SELECT * FROM trucks WHERE customer_id = ?';
  const params = [customerId];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY plate_number';
  const trucks = db.prepare(query).all(...params);
  res.json(trucks);
});

router.post('/', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { plate_number, driver_name, capacity_tons } = req.body;
  if (!plate_number) return res.status(400).json({ error: 'Plate number required', code: 'MISSING_PLATE' });
  try {
    const result = db.prepare('INSERT INTO trucks (customer_id, plate_number, driver_name, capacity_tons) VALUES (?, ?, ?, ?)').run(customerId, plate_number, driver_name || '', capacity_tons || 0);
    res.status(201).json({ id: result.lastInsertRowid, plate_number, driver_name, capacity_tons });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Plate number already exists', code: 'DUPLICATE_PLATE' });
    }
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { id } = req.params;
  const { plate_number, driver_name, capacity_tons, status } = req.body;
  const info = db.prepare('UPDATE trucks SET plate_number = ?, driver_name = ?, capacity_tons = ?, status = ? WHERE id = ? AND customer_id = ?').run(plate_number, driver_name || '', capacity_tons || 0, status || 'active', id, customerId);
  if (info.changes === 0) return res.status(404).json({ error: 'Truck not found', code: 'NOT_FOUND' });
  res.json({ id: Number(id), plate_number, driver_name, capacity_tons, status });
});

router.delete('/:id', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { id } = req.params;
  // Soft delete - just mark as archived
  const info = db.prepare("UPDATE trucks SET status = 'archived' WHERE id = ? AND customer_id = ?").run(id, customerId);
  if (info.changes === 0) return res.status(404).json({ error: 'Truck not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

router.put('/:id/reactivate', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { id } = req.params;
  const info = db.prepare("UPDATE trucks SET status = 'active' WHERE id = ? AND customer_id = ?").run(id, customerId);
  if (info.changes === 0) return res.status(404).json({ error: 'Truck not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

module.exports = router;
