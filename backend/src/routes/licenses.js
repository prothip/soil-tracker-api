const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ─── Public endpoints (no auth needed) ───────────────────────────────────────

// POST /api/licenses/register - Register a device to a license
router.post('/register', (req, res) => {
  const { licenseKey, fingerprint } = req.body;
  if (!licenseKey || !fingerprint) {
    return res.status(400).json({ error: 'Missing licenseKey or fingerprint' });
  }

  const existing = db.prepare('SELECT * FROM licenses WHERE license_key = ? AND status = ?').get(licenseKey, 'active');
  if (!existing) {
    return res.status(400).json({ error: 'Invalid license key' });
  }

  if (existing.fingerprint === fingerprint) {
    return res.json({ success: true, message: 'Device already registered' });
  }

  const fingerprintConflict = db.prepare('SELECT * FROM licenses WHERE fingerprint = ? AND license_key != ? AND status = ?').get(fingerprint, licenseKey, 'active');
  if (fingerprintConflict) {
    return res.status(400).json({ error: 'This device is already registered to another license' });
  }

  db.prepare('UPDATE licenses SET fingerprint = ? WHERE id = ?').run(fingerprint, existing.id);
  return res.json({ success: true, message: 'Device registered successfully' });
});

// GET /api/licenses/check?fingerprint=XXX - Check if device is registered
router.get('/check', (req, res) => {
  const { fingerprint } = req.query;
  if (!fingerprint) return res.status(400).json({ error: 'Missing fingerprint' });

  const registered = db.prepare('SELECT * FROM licenses WHERE fingerprint = ? AND status = ?').get(fingerprint, 'active');
  if (registered) {
    return res.json({ valid: true, registered: true, licenseKey: registered.license_key });
  }
  return res.json({ valid: false, registered: false });
});

// ─── Admin-only endpoints (auth required) ─────────────────────────────────────
router.use(authMiddleware);

// GET /api/licenses/generate - Generate a new license key
router.get('/generate', adminMiddleware, (req, res) => {
  const licenseKey = 'STPRO-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  try {
    db.prepare('INSERT INTO licenses (license_key, fingerprint, status) VALUES (?, ?, ?)').run(licenseKey, '', 'active');
    res.json({ licenseKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate license' });
  }
});

// GET /api/licenses/list - List all licenses
router.get('/list', adminMiddleware, (req, res) => {
  const licenses = db.prepare('SELECT id, license_key, fingerprint, status, created_at FROM licenses ORDER BY id DESC').all();
  res.json(licenses);
});

// PUT /api/licenses/:id/revoke
router.put('/:id/revoke', adminMiddleware, (req, res) => {
  db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run('revoked', req.params.id);
  res.json({ success: true });
});

// PUT /api/licenses/:id/activate
router.put('/:id/activate', adminMiddleware, (req, res) => {
  db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run('active', req.params.id);
  res.json({ success: true });
});

// DELETE /api/licenses/:id
router.delete('/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM licenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
