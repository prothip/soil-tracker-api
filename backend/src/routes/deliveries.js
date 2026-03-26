const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = require('../db/database');
  const { site_id, date, truck_id, material_id, search, page = 1, limit = 20 } = req.query;

  let where = ['1=1'];
  const params = [];

  if (site_id) { where.push('d.site_id = ?'); params.push(site_id); }
  if (date) { where.push('d.date = ?'); params.push(date); }
  if (truck_id) { where.push('d.truck_id = ?'); params.push(truck_id); }
  if (material_id) { where.push('d.material_id = ?'); params.push(material_id); }
  if (search) { where.push('(t.plate_number LIKE ? OR d.lot_number LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const offset = (Number(page) - 1) * Number(limit);
  const countWhere = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) as c FROM deliveries d LEFT JOIN trucks t ON d.truck_id=t.id LEFT JOIN materials m ON d.material_id=m.id WHERE ${countWhere}`).get(...params).c;

  const rows = db.prepare(`
    SELECT d.id, d.lot_number, d.weight_tons, d.notes, d.delivered_at, d.date,
           t.id as truck_id, t.plate_number, t.driver_name,
           m.id as material_id, m.name as material_name
    FROM deliveries d
    LEFT JOIN trucks t ON d.truck_id=t.id
    LEFT JOIN materials m ON d.material_id=m.id
    WHERE ${where.join(' AND ')}
    ORDER BY d.delivered_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({
    deliveries: rows,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

router.post('/', (req, res) => {
  const db = require('../db/database');
  const { site_id, truck_id, lot_number, material_id, weight_tons, notes, date, delivered_at } = req.body;
  if (!site_id || !truck_id) {
    return res.status(400).json({ error: 'site_id and truck_id required', code: 'MISSING_FIELDS' });
  }

  const finalDate = date || new Date().toISOString().split('T')[0];

  let finalLotNumber = lot_number;
  if (!finalLotNumber) {
    // Auto-generate lot number: {plate_number}-{date}-{SEQ}
    const truckRow = db.prepare('SELECT plate_number FROM trucks WHERE id = ?').get(Number(truck_id));
    if (!truckRow) {
      return res.status(400).json({ error: 'Truck not found', code: 'TRUCK_NOT_FOUND' });
    }
    const plateNumber = truckRow.plate_number;

    // Get next sequence for this truck+date
    const lastRow = db.prepare(`
      SELECT lot_number FROM deliveries
      WHERE truck_id = ? AND date = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(Number(truck_id), finalDate);

    let nextSeq = 1;
    if (lastRow && lastRow.lot_number) {
      const parts = lastRow.lot_number.split('-');
      const lastPart = parts[parts.length - 1];
      const seq = parseInt(lastPart, 10);
      if (!isNaN(seq)) {
        nextSeq = seq + 1;
      }
    }

    finalLotNumber = `${plateNumber}-${finalDate}-${String(nextSeq).padStart(3, '0')}`;
  }

  const finalTime = delivered_at || new Date().toISOString();

  try {
    const result = db.prepare(`
      INSERT INTO deliveries (site_id, truck_id, lot_number, material_id, weight_tons, notes, date, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(site_id, truck_id, finalLotNumber.toUpperCase(), material_id||null, weight_tons||0, notes||'', finalDate, finalTime);

    const row = db.prepare(`
      SELECT d.id, d.lot_number, d.weight_tons, d.notes, d.delivered_at, d.date,
             t.id as truck_id, t.plate_number, t.driver_name,
             m.id as material_id, m.name as material_name
      FROM deliveries d LEFT JOIN trucks t ON d.truck_id=t.id LEFT JOIN materials m ON d.material_id=m.id
      WHERE d.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const db = require('../db/database');
  const { id } = req.params;
  const { site_id, truck_id, lot_number, material_id, weight_tons, notes, date, delivered_at } = req.body;

  // Fetch existing delivery to merge with partial updates
  const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Delivery not found', code: 'NOT_FOUND' });

  const updated = {
    site_id: site_id ?? existing.site_id,
    truck_id: truck_id ?? existing.truck_id,
    lot_number: lot_number ? lot_number.toUpperCase() : existing.lot_number,
    material_id: material_id ?? existing.material_id,
    weight_tons: weight_tons ?? existing.weight_tons,
    notes: notes ?? existing.notes,
    date: date ?? existing.date,
    delivered_at: delivered_at ?? existing.delivered_at,
  };

  const info = db.prepare(`
    UPDATE deliveries SET site_id=?, truck_id=?, lot_number=?, material_id=?, weight_tons=?, notes=?, date=?, delivered_at=?
    WHERE id=?
  `).run(updated.site_id, updated.truck_id, updated.lot_number, updated.material_id, updated.weight_tons, updated.notes, updated.date, updated.delivered_at, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Delivery not found', code: 'NOT_FOUND' });

  const row = db.prepare(`
    SELECT d.id, d.lot_number, d.weight_tons, d.notes, d.delivered_at, d.date,
           t.id as truck_id, t.plate_number, t.driver_name,
           m.id as material_id, m.name as material_name
    FROM deliveries d LEFT JOIN trucks t ON d.truck_id=t.id LEFT JOIN materials m ON d.material_id=m.id
    WHERE d.id = ?
  `).get(id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const db = require('../db/database');
  const info = db.prepare('DELETE FROM deliveries WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Delivery not found', code: 'NOT_FOUND' });
  res.json({ success: true });
});

// Get next lot sequence for a truck+date combination
router.get('/next-lot', (req, res) => {
  const db = require('../db/database');
  const { truck_id, date } = req.query;
  if (!truck_id || !date) {
    return res.status(400).json({ error: 'truck_id and date required' });
  }
  const row = db.prepare(`
    SELECT lot_number FROM deliveries
    WHERE truck_id = ? AND date = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(Number(truck_id), date);

  let nextSeq = 1;
  if (row && row.lot_number) {
    // Extract the last segment (SEQ) from lot_number format: {plate}-{date}-{SEQ}
    const parts = row.lot_number.split('-');
    const lastPart = parts[parts.length - 1];
    const seq = parseInt(lastPart, 10);
    if (!isNaN(seq)) {
      nextSeq = seq + 1;
    }
  }

  res.json({ nextSeq });
});

// Check for duplicate lot number (site_id + date + lot_number)
router.get('/check-lot', (req, res) => {
  const db = require('../db/database');
  const { site_id, date, lot_number } = req.query;
  if (!site_id || !date || !lot_number) {
    return res.status(400).json({ error: 'site_id, date, and lot_number required' });
  }
  const row = db.prepare(
    'SELECT id, lot_number, date FROM deliveries WHERE site_id = ? AND date = ? AND lot_number = ?'
  ).get(Number(site_id), date, lot_number.toUpperCase());
  res.json({ duplicate: !!row, existing: row || null });
});

module.exports = router;
