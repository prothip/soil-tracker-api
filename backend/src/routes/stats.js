const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

function getCustomerId(req) {
  return req.user?.customerId || 1;
}

// Daily stats for a site + date
router.get('/daily', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { site_id, date } = req.query;
  if (!site_id || !date) return res.status(400).json({ error: 'site_id and date required' });

  const stats = db.prepare(`
    SELECT COUNT(*) as total_lots,
           COUNT(DISTINCT truck_id) as unique_trucks,
           COALESCE(SUM(weight_tons), 0) as total_tons
    FROM deliveries WHERE site_id = ? AND date = ? AND customer_id = ?
  `).get(site_id, date, customerId);

  // Weekly stats (last 7 days including date)
  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekEnd = date;

  const weekStats = db.prepare(`
    SELECT date, COUNT(*) as lots, COALESCE(SUM(weight_tons),0) as tons
    FROM deliveries
    WHERE site_id = ? AND date >= ? AND date <= ? AND customer_id = ?
    GROUP BY date
    ORDER BY date ASC
  `).all(site_id, weekStart.toISOString().split('T')[0], weekEnd, customerId);

  // Recent deliveries (last 5)
  const recent = db.prepare(`
    SELECT d.id, d.lot_number, d.weight_tons, d.delivered_at, d.date,
           t.plate_number, t.driver_name, m.name as material_name
    FROM deliveries d
    LEFT JOIN trucks t ON d.truck_id=t.id
    LEFT JOIN materials m ON d.material_id=m.id
    WHERE d.site_id = ? AND d.customer_id = ?
    ORDER BY d.delivered_at DESC LIMIT 5
  `).all(site_id, customerId);

  res.json({ stats, weekStats, recent });
});

// Stats for a date range (for charts)
router.get('/range', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const { site_id, start, end, material_id } = req.query;
  if (!site_id || !start || !end) return res.status(400).json({ error: 'site_id, start, end required' });

  let where = ['d.site_id = ?', 'd.date >= ?', 'd.date <= ?', 'd.customer_id = ?'];
  const params = [site_id, start, end, customerId];
  if (material_id) { where.push('d.material_id = ?'); params.push(material_id); }

  const daily = db.prepare(`
    SELECT d.date, COUNT(*) as lots, COALESCE(SUM(d.weight_tons),0) as tons
    FROM deliveries d
    WHERE ${where.join(' AND ')}
    GROUP BY d.date ORDER BY d.date ASC
  `).all(...params);

  const byTruck = db.prepare(`
    SELECT t.plate_number, t.driver_name, COUNT(*) as lots, COALESCE(SUM(d.weight_tons),0) as tons
    FROM deliveries d
    LEFT JOIN trucks t ON d.truck_id=t.id
    WHERE ${where.join(' AND ')}
    GROUP BY d.truck_id ORDER BY tons DESC
  `).all(...params);

  const grand = db.prepare(`
    SELECT COUNT(*) as total_lots, COALESCE(SUM(d.weight_tons),0) as total_tons
    FROM deliveries d WHERE ${where.join(' AND ')}
  `).get(...params);

  res.json({ daily, byTruck, grand });
});

// Total delivery count for customer
router.get('/count', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const row = db.prepare('SELECT COUNT(*) as count FROM deliveries WHERE customer_id = ?').get(customerId);
  res.json({ count: row.count });
});

// All-time totals for customer
router.get('/alltime', (req, res) => {
  const db = require('../db/database');
  const customerId = getCustomerId(req);
  const row = db.prepare('SELECT COUNT(*) as total_lots, COALESCE(SUM(weight_tons), 0) as total_tons FROM deliveries WHERE customer_id = ?').get(customerId);
  res.json(row);
});

module.exports = router;
