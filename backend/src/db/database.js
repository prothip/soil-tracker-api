const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'pro.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Multi-tenant: customers are the top-level entities (each activation = 1 customer)
db.exec(`
  -- Customers table (each paying customer = 1 customer)
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    activation_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
  );

  -- Admin users (global, not customer-specific)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Sites belong to customers
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Trucks belong to customers
  CREATE TABLE IF NOT EXISTS trucks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    driver_name TEXT,
    capacity_tons REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, plate_number)
  );

  -- Materials belong to customers
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(customer_id, name)
  );

  -- Deliveries belong to customers
  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    lot_number TEXT NOT NULL,
    material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
    weight_tons REAL DEFAULT 0,
    notes TEXT,
    delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    date TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
  CREATE INDEX IF NOT EXISTS idx_deliveries_site ON deliveries(site_id);
  CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);
  CREATE INDEX IF NOT EXISTS idx_deliveries_truck ON deliveries(truck_id);
  CREATE INDEX IF NOT EXISTS idx_sites_customer ON sites(customer_id);
  CREATE INDEX IF NOT EXISTS idx_trucks_customer ON trucks(customer_id);
  CREATE INDEX IF NOT EXISTS idx_materials_customer ON materials(customer_id);

  -- Activation codes
  CREATE TABLE IF NOT EXISTS codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    expires_at TEXT,
    max_uses INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Offline activations
  CREATE TABLE IF NOT EXISTS offline_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    expires_at TEXT,
    status TEXT DEFAULT 'active',
    used_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Licenses
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    fingerprint TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
  );
`);

// Seed admin user
const hasUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (hasUsers === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
}

// Seed default demo code (maps to customer_id 1)
const hasCustomers = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
if (hasCustomers === 0) {
  db.prepare('INSERT INTO customers (name, activation_code, status) VALUES (?, ?, ?)').run('Default Customer', 'STP-DEMO01', 'active');
  db.prepare('INSERT OR IGNORE INTO codes (code, customer_id, status) VALUES (?, ?, ?)').run('STP-DEMO01', 1, 'active');
}

module.exports = db;
