const express = require('express');
const router = express.Router();
const { verifyCode, listCodes, generateCodes, deleteCode } = require('../db/offline-codes');

// ─── Public ─────────────────────────────────────────────────────────────────

// POST /api/offline/activate — register a device with an activation code
router.post('/activate', (req, res) => {
  const { activationCode } = req.body;
  if (!activationCode) return res.status(400).json({ error: 'Code required' });

  const result = verifyCode(activationCode);
  if (result.error) return res.status(401).json({ error: result.error });
  
  res.json({ success: true, deviceId: result.deviceId });
});

// ─── Generator routes (public for demo - add auth in production) ─────────────

// GET /api/offline/codes — list all offline activation codes
router.get('/codes', (req, res) => {
  const codes = listCodes();
  res.json({ codes });
});

// POST /api/offline/codes/generate — generate new activation codes
router.post('/codes/generate', (req, res) => {
  const { count = 1, expiryDays = 30 } = req.body;
  const codes = generateCodes(count, expiryDays);
  res.json({ codes });
});

// DELETE /api/offline/codes/:id — delete a code
router.delete('/codes/:id', (req, res) => {
  deleteCode(parseInt(req.params.id));
  res.json({ success: true });
});

// POST /api/offline/seed — TEMP: seed STP codes (remove after use)
router.post('/seed', (req, res) => {
  const codes = generateCodes(5);
  res.json({ success: true, codes });
});

module.exports = router;
