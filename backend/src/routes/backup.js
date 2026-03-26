const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '..', 'data', 'pro.db');

// GET /api/backup — download a backup of the SQLite database
router.get('/', authMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const filename = `soil-tracker-backup-${today}.db`;

    res.setHeader('Content-Type', 'application/vnd.sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('Backup stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream backup file' });
      }
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// POST /api/backup/restore — restore from a backup file (base64 encoded .db)
router.post('/restore', authMiddleware, (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'No file data provided' });

    let buffer;
    try {
      buffer = Buffer.from(file, 'base64');
    } catch {
      return res.status(400).json({ error: 'Invalid base64 data' });
    }

    // Validate it looks like a SQLite database (SQLite files start with "SQLite format 3")
    if (buffer.length < 16 || !buffer.slice(0, 16).toString().startsWith('SQLite')) {
      return res.status(400).json({ error: 'Invalid backup file — not a valid SQLite database' });
    }

    const tmpPath = dbPath + '.restoring';
    fs.writeFileSync(tmpPath, buffer);

    // Verify the file opens correctly as SQLite before replacing
    let testDb;
    try {
      testDb = require('better-sqlite3')(tmpPath, { readonly: true });
      testDb.prepare('SELECT 1').get();
      testDb.close();
    } catch (err) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'Backup file is corrupted or invalid' });
    }

    // Atomically replace the old DB with the restored one
    const oldPath = dbPath + '.old';
    if (fs.existsSync(dbPath)) fs.renameSync(dbPath, oldPath);
    fs.renameSync(tmpPath, dbPath);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    res.json({ message: 'Database restored successfully — reloading...' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

module.exports = router;
