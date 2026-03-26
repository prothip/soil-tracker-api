const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors({
  origin: true,
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization,X-Requested-With'
}));
app.use(express.json());

const APP_VERSION = '1.0.0';

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/device-login'));
app.use('/api/auth', require('./routes/reset-with-code'))
app.use('/api/sites', require('./routes/sites'));
app.use('/api/trucks', require('./routes/trucks'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/export', require('./routes/export'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/reset', require('./routes/reset'));
app.use('/api/licenses', require('./routes/licenses'));

app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION });
});

// Serve built frontend in production
const path = require('path');
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all: serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Soil Tracker Pro API running on http://${HOST}:${PORT}`);
});
