const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

// Determine base directory
const BASE_DIR = path.resolve(__dirname);
const PUBLIC_DIR = path.join(BASE_DIR, 'public');

app.use(cors({
  origin: true,
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization,X-Requested-With'
}));
app.use(express.json());

const APP_VERSION = '1.0.0';

// ─── Offline APK routes (activation only) ───────────────────────────────────
app.use('/api/offline', require('./routes/offline'));

// ─── Admin panel ─────────────────────────────────────────────────────────────
app.get('/license-generator', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, 'generator.html');
  res.sendFile(filePath);
});

// ─── API version ─────────────────────────────────────────────────────────────
app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION });
});

// ─── Fallback ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Soil Tracker Pro API running on http://0.0.0.0:${PORT}`);
  console.log(`Serving from: ${PUBLIC_DIR}`);
});
