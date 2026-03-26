const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Device login — validates activation code via activation-gen, returns STP token
router.post('/device-login', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Activation code required' });
  }

  // Validate against activation-gen
  let valid = false;
  try {
    const response = await fetch('http://localhost:3003/api/codes/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() })
    });
    const result = await response.json();
    valid = result.valid;
  } catch (err) {
    return res.status(503).json({ error: 'Cannot reach activation server' });
  }

  if (!valid) {
    return res.status(401).json({ error: 'Invalid or expired activation code' });
  }

  // Issue a device token for STP backend
  const deviceToken = jwt.sign(
    { type: 'device', code: code.trim().toUpperCase() },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token: deviceToken, message: 'Activated successfully' });
});

module.exports = router;
