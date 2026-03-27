const express = require('express');
const router = express.Router();
const { verifyCode, listCodes, generateCodes, deleteCode } = require('../db/offline-codes');

// POST /api/offline/activate — device activation
router.post('/activate', (req, res) => {
  const { activationCode } = req.body;
  if (!activationCode) return res.status(400).json({ error: 'Code required' });
  const result = verifyCode(activationCode);
  if (result.error) return res.status(401).json({ error: result.error });
  res.json({ success: true, deviceId: result.deviceId });
});

// GET /api/offline/codes — list codes
router.get('/codes', (req, res) => {
  res.json({ codes: listCodes() });
});

// POST /api/offline/codes/generate — generate codes
router.post('/codes/generate', (req, res) => {
  const { count = 1, expiryDays = 30 } = req.body;
  res.json({ codes: generateCodes(count, expiryDays) });
});

// DELETE /api/offline/codes/:id — delete code
router.delete('/codes/:id', (req, res) => {
  deleteCode(parseInt(req.params.id));
  res.json({ success: true });
});

module.exports = router;
