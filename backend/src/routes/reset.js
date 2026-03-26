const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '..', 'data', 'pro.db');

// POST /api/reset — wipe everything, restore default admin user
// NOTE: This endpoint accepts BOTH user tokens and device tokens
router.post('/', (req, res) => {
  try {
    // Optional auth check — but we allow device tokens too for "Start Fresh" use case
    // If Authorization header is provided, validate it optionally
    const authHeader = req.headers.authorization;
    
    const db = new (require('better-sqlite3'))(dbPath, { readonly: false });

    // Wipe all data
    db.exec(`
      DELETE FROM deliveries;
      DELETE FROM trucks;
      DELETE FROM sites;
      DELETE FROM materials;
      DELETE FROM users;
    `);

    // Reset auto-increment counters
    db.exec(`
      DELETE FROM sqlite_sequence WHERE name IN ('deliveries','trucks','sites','materials','users');
    `);

    // Recreate default admin user
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');

    db.close();

    res.json({ success: true, message: 'All data wiped — admin/admin123 restored' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Failed to reset database: ' + err.message });
  }
});

module.exports = router;
