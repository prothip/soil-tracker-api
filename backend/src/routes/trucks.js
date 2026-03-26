const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = require('../db/database');
  const { status } = req.query;
  let sql = 'SELECT * FROM trucks';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY plate_number';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const db = require('../db/database');
  const { plate_number, driver_name, capacity_tons } = req.body;
  if (!plate_number) return res.status(400).json({ error: 'Plate number required', code: 'MISSING_PLATE' });
  try {
    const result = db.prepare('INSERT INTO trucks (plate_number, driver_name, capacity_tons) VALUES (?, ?, ?)').run(plate_number, driver_name || '', capacity_tons || 0);
    res.status(201).json({ id: result.lastInsertRowid, plate_number, driver_name, capacity_tons: capacity_tons || 0, status: 'active' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Plate number already exists', code: 'DUPLICATE_PLATE' });
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const db = require('../db/database');
  const { id } = req.params;
  const { plate_number, driver_name, capacity_tons, status } = req.body;

  // Fetch existing truck to merge with partial updates
  const existing = db.prepare('SELECT * FROM trucks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Truck not found', code: 'NOT_FOUND' });

  const updated = {
    plate_number: plate_number ?? existing.plate_number,
    driver_name: driver_name ?? existing.driver_name,
    capacity_tons: capacity_tons ?? existing.capacity_tons,
    status: status ?? existing.status,
  };

  const info = db.prepare('UPDATE trucks SET plate_number=?, driver_name=?, capacity_tons=?, status=? WHERE id=?').run(
    updated.plate_number, updated.driver_name, updated.capacity_tons, updated.status, id
  );
  res.json({ id: Number(id), ...updated });
});

router.delete('/:id', (req, res) => {
  const db = require('../db/database');
  const { id } = req.params;
  // Soft delete — set inactive
  const info = db.prepare("UPDATE trucks SET status='inactive' WHERE id=? AND status='active'").run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Active truck not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

module.exports = router;
