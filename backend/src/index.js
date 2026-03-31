console.log("STARTING SERVER");
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3002;
const base = __dirname;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => res.json({ ok: true }));

// API routes
app.use('/api/sites', require(base + '/routes/sites.js'));
app.use('/api/trucks', require(base + '/routes/trucks.js'));
app.use('/api/materials', require(base + '/routes/materials.js'));
app.use('/api/deliveries', require(base + '/routes/deliveries.js'));
app.use('/api/auth', require(base + '/routes/auth.js'));
app.use('/api/offline', require(base + '/routes/offline.js'));
app.use('/api/stats', require(base + '/routes/stats.js'));
app.use('/api/export', require(base + '/routes/export.js'));
app.use('/api/backup', require(base + '/routes/backup.js'));
app.use('/api/reset', require(base + '/routes/reset.js'));
app.use('/api/device-login', require(base + '/routes/device-login.js'));
app.use('/api/reset-with-code', require(base + '/routes/reset-with-code.js'));
app.use('/api/licenses', require(base + '/routes/licenses.js'));
app.use('/api/codes', require(base + '/routes/codes.js'));
app.use('/api/admin', require(base + '/routes/admin.js'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
