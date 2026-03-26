const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

router.use(authMiddleware);

function getDeliveries(db, siteId, start, end, materialId) {
  let where = ['d.site_id = ?', 'd.date >= ?', 'd.date <= ?'];
  const params = [siteId, start, end];
  if (materialId) { where.push('d.material_id = ?'); params.push(materialId); }
  return db.prepare(`
    SELECT d.id, d.lot_number, d.weight_tons, d.notes, d.delivered_at, d.date,
           t.plate_number, t.driver_name, m.name as material_name
    FROM deliveries d
    LEFT JOIN trucks t ON d.truck_id=t.id
    LEFT JOIN materials m ON d.material_id=m.id
    WHERE ${where.join(' AND ')}
    ORDER BY d.delivered_at DESC
  `).all(...params);
}

// ─── CSV ────────────────────────────────────────────────────────────────────
router.get('/csv', (req, res) => {
  const db = require('../db/database');
  const { site_id, start, end, material_id } = req.query;
  if (!site_id || !start || !end) return res.status(400).json({ error: 'site_id, start, end required' });

  const rows = getDeliveries(db, site_id, start, end, material_id);
  const header = 'Date,Time,Truck,Driver,Lot #,Material,Weight (tons),Notes\n';
  const csv = rows.map(r => [
    r.date,
    r.delivered_at ? r.delivered_at.split('T')[1].slice(0,5) : '',
    r.plate_number, r.driver_name||'', r.lot_number, r.material_name||'',
    r.weight_tons, (r.notes||'').replace(/"/g, '""')
  ].map(v => `"${v}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="deliveries-${start}-to-${end}.csv"`);
  res.send(header + csv);
});

// ─── PDF ────────────────────────────────────────────────────────────────────
router.get('/pdf', (req, res) => {
  const db = require('../db/database');
  const { site_id, start, end, material_id, site_name } = req.query;
  if (!site_id || !start || !end) return res.status(400).json({ error: 'site_id, start, end required' });

  const rows = getDeliveries(db, site_id, start, end, material_id);
  const totalTons = rows.reduce((s, r) => s + (r.weight_tons || 0), 0);
  const totalLots = rows.length;
  const uniqueTrucks = [...new Set(rows.map(r => r.plate_number))].length;

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${start}-to-${end}.pdf"`);
    res.end(Buffer.concat(chunks));
  });

  // Title block
  doc.fillColor('#2563EB').fontSize(20).text('Soil Tracker Pro', { align: 'center' });
  doc.fillColor('#1a1a1a').fontSize(14).text('Delivery Report  |  ' + (site_name || 'All Sites'), { align: 'center' });
  doc.fillColor('#64748b').fontSize(11).text(start + ' -> ' + end, { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor('#1a1a1a').fontSize(12).text(
    totalLots + ' deliveries  |  ' + totalTons.toFixed(2) + ' tons  |  ' + uniqueTrucks + ' trucks',
    { align: 'center' }
  );
  doc.moveDown(1);

  const startY = doc.y;

  // Stats boxes
  const boxW = 130, boxH = 48;
  doc.rect(40, startY, boxW, boxH).fill('#eff6ff');
  doc.rect(40+boxW, startY, boxW, boxH).fill('#fffbeb');
  doc.rect(40+boxW*2, startY, boxW, boxH).fill('#ecfdf5');
  doc.fillColor('#1a1a1a').fontSize(10).text('Deliveries', 40, startY+8, { width: boxW, align: 'center' });
  doc.fillColor('#2563EB').fontSize(18).text(String(totalLots), 40, startY+22, { width: boxW, align: 'center' });
  doc.fillColor('#1a1a1a').fontSize(10).text('Tons', 40+boxW, startY+8, { width: boxW, align: 'center' });
  doc.fillColor('#D97706').fontSize(18).text(totalTons.toFixed(1), 40+boxW, startY+22, { width: boxW, align: 'center' });
  doc.fillColor('#1a1a1a').fontSize(10).text('Trucks', 40+boxW*2, startY+8, { width: boxW, align: 'center' });
  doc.fillColor('#059669').fontSize(18).text(String(uniqueTrucks), 40+boxW*2, startY+22, { width: boxW, align: 'center' });

  doc.y = startY + boxH + 14;

  // Table
  const cols = [75, 55, 90, 100, 120, 75, 50, 165];
  const hdrs = ['Date', 'Time', 'Truck', 'Driver', 'Lot #', 'Material', 'Tons', 'Notes'];
  const rowH = 20;
  const tableTop = doc.y;

  // Header row
  doc.rect(40, tableTop, 780, rowH).fill('#1a1a2e');
  doc.fillColor('white').fontSize(10);
  let cx = 45;
  hdrs.forEach((h, i) => { doc.text(h, cx, tableTop+5, { width: cols[i] }); cx += cols[i]; });

  // Data rows
  let ry = tableTop + rowH;
  if (rows.length === 0) {
    doc.rect(40, ry, 780, rowH).fill('#f8fafc');
    doc.fillColor('#64748b').fontSize(10).text('No deliveries found for this period', 45, ry+5, { width: 780, align: 'center' });
    ry += rowH;
  } else {
    rows.forEach((r, idx) => {
      if (ry + rowH > 555) {
        doc.addPage();
        ry = 40;
        doc.rect(40, ry, 780, rowH).fill('#1a1a2e');
        doc.fillColor('white').fontSize(10);
        cx = 45;
        hdrs.forEach((h, i) => { doc.text(h, cx, ry+5, { width: cols[i] }); cx += cols[i]; });
        ry += rowH;
      }
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, ry, 780, rowH).fill(bg);
      doc.fillColor('#1a1a1a').fontSize(9);
      cx = 45;
      const vals = [
        r.date || '',
        r.delivered_at ? r.delivered_at.split('T')[1].slice(0,5) : '',
        r.plate_number || '',
        r.driver_name || '',
        r.lot_number || '',
        r.material_name || '',
        (r.weight_tons || 0).toFixed(1),
        (r.notes || '').slice(0, 30)
      ];
      vals.forEach((v, i) => { doc.text(String(v), cx, ry+5, { width: cols[i] }); cx += cols[i]; });
      ry += rowH;
    });

    // Total row
    doc.rect(40, ry, 780, rowH).fill('#e2e8f0');
    doc.fillColor('#1a1a2e').fontSize(10).font('Helvetica-Bold');
    cx = 45;
    ['', '', '', '', 'TOTAL', '', totalTons.toFixed(1) + ' t', ''].forEach((v, i) => {
      doc.text(v, cx, ry+5, { width: cols[i] });
      cx += cols[i];
    });
    ry += rowH;
  }

  // Footer
  doc.fillColor('#94a3b8').fontSize(8).font('Helvetica');
  doc.text('Soil Tracker Pro -- Generated ' + new Date().toLocaleString('en-GB'), 40, 560, { align: 'center' });

  doc.end();
});

// ─── Excel ─────────────────────────────────────────────────────────────────
router.get('/excel', (req, res) => {
  const db = require('../db/database');
  const { site_id, start, end, material_id, site_name } = req.query;
  if (!site_id || !start || !end) return res.status(400).json({ error: 'site_id, start, end required' });

  const rows = getDeliveries(db, site_id, start, end, material_id);
  const totalTons = rows.reduce((s, r) => s + (r.weight_tons || 0), 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Soil Tracker Pro';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [{ width: 25 }, { width: 30 }];
  summarySheet.getCell('A1').value = 'SOIL TRACKER PRO -- DELIVERY REPORT';
  summarySheet.getCell('A1').font = { bold: true, size: 14 };
  summarySheet.getCell('A2').value = 'Site: ' + (site_name || 'N/A');
  summarySheet.getCell('A3').value = 'Period: ' + start + ' -> ' + end;
  summarySheet.getCell('A4').value = 'Generated: ' + new Date().toLocaleDateString('en-GB');
  summarySheet.getCell('A6').value = 'Total Deliveries';
  summarySheet.getCell('B6').value = rows.length;
  summarySheet.getCell('A7').value = 'Total Weight (tons)';
  summarySheet.getCell('B7').value = totalTons;
  summarySheet.getCell('A8').value = 'Unique Trucks';
  summarySheet.getCell('B8').value = [...new Set(rows.map(r => r.plate_number))].length;

  const truckSheet = workbook.addWorksheet('By Truck');
  truckSheet.columns = [{ width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }];
  const byTruck = {};
  rows.forEach(r => {
    const k = r.plate_number;
    if (!byTruck[k]) byTruck[k] = { plate: k, driver: r.driver_name, lots: 0, tons: 0 };
    byTruck[k].lots++;
    byTruck[k].tons += r.weight_tons || 0;
  });
  truckSheet.getCell('A1').value = 'Truck';
  truckSheet.getCell('B1').value = 'Driver';
  truckSheet.getCell('C1').value = 'Lots';
  truckSheet.getCell('D1').value = 'Total Tons';
  truckSheet.getRow(1).font = { bold: true };
  Object.values(byTruck).forEach((t, i) => {
    truckSheet.getCell('A' + (i+2)).value = t.plate;
    truckSheet.getCell('B' + (i+2)).value = t.driver || '';
    truckSheet.getCell('C' + (i+2)).value = t.lots;
    truckSheet.getCell('D' + (i+2)).value = t.tons;
  });

  const detailSheet = workbook.addWorksheet('All Deliveries');
  detailSheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Time', key: 'time', width: 10 },
    { header: 'Truck', key: 'truck', width: 14 },
    { header: 'Driver', key: 'driver', width: 18 },
    { header: 'Lot #', key: 'lot', width: 12 },
    { header: 'Material', key: 'material', width: 14 },
    { header: 'Weight (tons)', key: 'tons', width: 14 },
    { header: 'Notes', key: 'notes', width: 25 },
  ];
  rows.forEach((r, i) => {
    detailSheet.getRow(i+2).values = [
      r.date,
      r.delivered_at ? r.delivered_at.split('T')[1].slice(0,5) : '',
      r.plate_number || '',
      r.driver_name || '',
      r.lot_number,
      r.material_name || '',
      r.weight_tons || 0,
      r.notes || ''
    ];
  });
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
  detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="report-${start}-to-${end}.xlsx"`);
  workbook.xlsx.write(res).then(() => res.end());
});

module.exports = router;
