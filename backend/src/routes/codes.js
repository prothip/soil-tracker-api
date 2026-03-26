const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');

const router = express.Router();

function generateCode() {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

// POST /api/codes/activate — validate a code (no auth needed)
router.post('/activate', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.json({ valid: false, error: 'Code is required' });

    const normalized = code.trim().toUpperCase();
    const record = db.prepare('SELECT * FROM codes WHERE code = ?').get(normalized);

    if (!record) return res.json({ valid: false, error: 'Invalid code' });
    if (record.status === 'deactivated') return res.json({ valid: false, error: 'Code has been deactivated' });
    if (record.expires_at && new Date(record.expires_at) < new Date()) return res.json({ valid: false, error: 'Code has expired' });
    if (record.max_uses > 0 && record.use_count >= record.max_uses) return res.json({ valid: false, error: 'Code has reached its usage limit' });

    db.prepare('UPDATE codes SET use_count = use_count + 1 WHERE id = ?').run(record.id);
    if (record.max_uses > 0 && record.use_count + 1 >= record.max_uses) {
      db.prepare("UPDATE codes SET status = 'used' WHERE id = ?").run(record.id);
    }

    res.json({ valid: true, message: 'Activated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/codes — list all codes (auth required)
router.get('/', (req, res) => {
  const codes = db.prepare('SELECT * FROM codes ORDER BY created_at DESC').all();
  res.json(codes);
});

// POST /api/codes — generate new codes (auth required)
router.post('/', (req, res) => {
  const { count = 1, expiryDays = 0, maxUses = 0 } = req.body;
  const codes = [];
  const insert = db.prepare(`INSERT INTO codes (code, expires_at, max_uses, status) VALUES (?, ?, ?, 'active')`);

  for (let i = 0; i < count; i++) {
    let code, attempts = 0;
    do { code = generateCode(); attempts++; } while (db.prepare('SELECT id FROM codes WHERE code = ?').get(code) && attempts < 10);
    const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : null;
    const result = insert.run(code, expiresAt, maxUses);
    codes.push({ id: result.lastInsertRowid, code, expires_at: expiresAt, max_uses: maxUses, use_count: 0, status: 'active' });
  }
  res.json({ codes });
});

// PATCH /api/codes/:id — update code status (auth required)
router.patch('/:id', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE codes SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// DELETE /api/codes/:id — delete code (auth required)
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM codes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
