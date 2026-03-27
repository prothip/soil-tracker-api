const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

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
  res.sendFile(path.join(__dirname, '../public/generator.html'));
});

// ─── API version ─────────────────────────────────────────────────────────────
app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION });
});

// ─── Fallback ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Soil Tracker Pro API running on http://${HOST}:${PORT}`);
});
