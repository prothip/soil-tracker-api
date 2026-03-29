const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/database');

// ─── Public ─────────────────────────────────────────────────────────────────

// POST /api/offline/activate — register a device with an activation code
router.post('/activate', (req, res) => {
  const { activationCode } = req.body;
  if (!activationCode) return res.status(400).json({ error: 'Code required' });

  const normalized = activationCode.trim().toUpperCase();
  const code = db.prepare('SELECT * FROM offline_activations WHERE code = ?').get(normalized);

  if (!code) return res.status(401).json({ error: 'Invalid activation code' });
  if (code.status === 'used') return res.status(401).json({ error: 'Code already used' });
  if (code.expires_at && new Date(code.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Code has expired' });
  }

  // Mark as used
  db.prepare("UPDATE offline_activations SET status = 'used', used_at = ? WHERE id = ?")
    .run(new Date().toISOString(), code.id);

  const deviceId = crypto.randomBytes(16).toString('hex');
  res.json({ success: true, deviceId });
});

// ─── Auth middleware ─────────────────────────────────────────────────────────
const { authMiddleware } = require('../middleware/auth');

// GET /api/offline/codes — list all offline activation codes (admin only)
router.get('/codes', authMiddleware, (req, res) => {
  const codes = db.prepare(
    'SELECT id, code, status, expires_at, created_at, used_at FROM offline_activations ORDER BY id DESC'
  ).all();
  res.json({ codes });
});

// POST /api/offline/codes/generate — generate new activation codes (admin only)
router.post('/codes/generate', authMiddleware, (req, res) => {
  const { count = 1, expiryDays = 30 } = req.body;
  const codes = [];
  const insert = db.prepare(
    'INSERT INTO offline_activations (code, expires_at, status) VALUES (?, ?, ?)'
  );

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `STP-ACT-${raw}`;
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const result = insert.run(code, expiresAt, 'active');
    codes.push({ id: result.lastInsertRowid, code, expires_at: expiresAt, status: 'active' });
  }

  res.json({ codes });
});

// DELETE /api/offline/codes/:id — delete a code (admin only)
router.delete('/codes/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM offline_activations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/offline/sync — receive deliveries from offline device
router.post('/sync', async (req, res) => {
  const { deviceId, deliveries = [], trucks = [], sites = [], materials = [] } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  try {
    // Disable FK checks for this bulk import, re-enable after
    db.exec('PRAGMA foreign_keys = OFF');

    // Sync sites
    const upsertSite = db.prepare(`
      INSERT INTO sites (id, name, location, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, location=excluded.location
    `);
    for (const s of sites) {
      upsertSite.run(s.id, s.name, s.location || null, s.created_at || null);
    }

    // Sync trucks
    const upsertTruck = db.prepare(`
      INSERT INTO trucks (id, plate_number, driver_name, capacity_tons, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET plate_number=excluded.plate_number, driver_name=excluded.driver_name, status=excluded.status
    `);
    for (const t of trucks) {
      upsertTruck.run(t.id, t.plate_number, t.driver_name || null, t.capacity_tons || 0, t.status || 'active', t.created_at || null);
    }

    // Sync materials
    const upsertMat = db.prepare(`
      INSERT INTO materials (id, name) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name
    `);
    for (const m of materials) {
      upsertMat.run(m.id, m.name);
    }

    // Sync deliveries (only insert new ones, by lot_number + date + site_id)
    const insertDelivery = db.prepare(`
      INSERT INTO deliveries (site_id, truck_id, lot_number, material_id, weight_tons, notes, date, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkDelivery = db.prepare(
      'SELECT id FROM deliveries WHERE site_id = ? AND lot_number = ? AND date = ?'
    );
    let deliveryCount = 0;
    for (const d of deliveries) {
      const existing = checkDelivery.get(d.site_id || null, d.lot_number, d.date);
      if (!existing) {
        insertDelivery.run(
          d.site_id || null, d.truck_id || null, d.lot_number, d.material_id || null,
          d.weight_tons || 0, d.notes || '', d.date, d.delivered_at || null
        );
        deliveryCount++;
      }
    }

    db.exec('PRAGMA foreign_keys = ON');

    res.json({ success: true, serverTimestamp: new Date().toISOString(), deliveriesImported: deliveryCount });
  } catch (err) {
    db.exec('PRAGMA foreign_keys = ON');
    console.error('Sync error:', err.message);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

// GET /api/offline/data — get reference data for a device (admin auth required)
router.get('/data', authMiddleware, (req, res) => {
  try {
    const trucks = db.prepare('SELECT * FROM trucks ORDER BY id').all();
    const sites = db.prepare('SELECT * FROM sites ORDER BY id').all();
    const materials = db.prepare('SELECT * FROM materials ORDER BY id').all();
    res.json({ trucks, sites, materials });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

module.exports = router;
