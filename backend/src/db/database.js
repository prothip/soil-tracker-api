const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'pro.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trucks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT UNIQUE NOT NULL,
    driver_name TEXT,
    capacity_tons REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER REFERENCES sites(id),
    truck_id INTEGER REFERENCES trucks(id),
    lot_number TEXT NOT NULL,
    material_id INTEGER REFERENCES materials(id),
    weight_tons REAL DEFAULT 0,
    notes TEXT,
    delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    date TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_deliveries_site ON deliveries(site_id);
  CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);
  CREATE INDEX IF NOT EXISTS idx_deliveries_truck ON deliveries(truck_id);

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    fingerprint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    expires_at TEXT,
    max_uses INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed data — admin user only, no preset sites/trucks/materials
const hasUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (hasUsers === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
}

// Seed default demo license
db.prepare('INSERT OR IGNORE INTO licenses (license_key, fingerprint, status) VALUES (?, ?, ?)').run('STPRO-FIRST', '', 'active');

// Seed initial activation codes (demo codes)
const seedCodes = ['DEMO-0001', 'DEMO-0002', 'DEMO-0003'];
const insertCode = db.prepare('INSERT OR IGNORE INTO codes (code, status) VALUES (?, ?)');
for (const code of seedCodes) insertCode.run(code, 'active');

module.exports = db;
