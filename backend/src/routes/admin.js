const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Apply admin auth to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

const db = require('../db/database');

// GET /api/admin/customers — list all customers
router.get('/customers', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  res.json(customers);
});

// POST /api/admin/customers — create a customer
router.post('/customers', (req, res) => {
  const { name, activation_code } = req.body;
  if (!name || !activation_code) {
    return res.status(400).json({ error: 'Name and activation_code required' });
  }
  try {
    const result = db.prepare('INSERT INTO customers (name, activation_code, status) VALUES (?, ?, ?)').run(name, activation_code.toUpperCase(), 'active');
    res.status(201).json({ id: result.lastInsertRowid, name, activation_code, status: 'active' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Activation code already exists' });
    }
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/customers/:id/sites — get customer's sites
router.get('/customers/:id/sites', (req, res) => {
  const sites = db.prepare('SELECT * FROM sites WHERE customer_id = ? ORDER BY name').all(req.params.id);
  res.json(sites);
});

// GET /api/admin/customers/:id/trucks — get customer's trucks
router.get('/customers/:id/trucks', (req, res) => {
  const trucks = db.prepare('SELECT * FROM trucks WHERE customer_id = ? ORDER BY plate_number').all(req.params.id);
  res.json(trucks);
});

// GET /api/admin/customers/:id/deliveries — get customer's deliveries
router.get('/customers/:id/deliveries', (req, res) => {
  const deliveries = db.prepare(`
    SELECT d.*, t.plate_number, m.name as material_name
    FROM deliveries d
    LEFT JOIN trucks t ON d.truck_id = t.id
    LEFT JOIN materials m ON d.material_id = m.id
    WHERE d.customer_id = ?
    ORDER BY d.delivered_at DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(deliveries);
});

// GET /api/admin/customers/:id/stats — get customer's stats
router.get('/customers/:id/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_deliveries,
      COALESCE(SUM(weight_tons), 0) as total_tons
    FROM deliveries WHERE customer_id = ?
  `).get(req.params.id);
  const siteCount = db.prepare('SELECT COUNT(*) as c FROM sites WHERE customer_id = ?').get(req.params.id).c;
  const truckCount = db.prepare('SELECT COUNT(*) as c FROM trucks WHERE customer_id = ?').get(req.params.id).c;
  res.json({ ...stats, siteCount, truckCount });
});

// DELETE /api/admin/customers/:id — delete a customer and all their data
router.delete('/customers/:id', (req, res) => {
  const { id } = req.params;
  // Check if it's the last customer (don't delete last customer)
  const count = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  if (count <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last customer' });
  }
  const info = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json({ success: true });
});

module.exports = router;
