// Local SQLite Database for Offline-First Soil Tracker Pro
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const DB_NAME = 'soil_tracker_db'
let db = null
let sqliteConnection = null

// Initialize the database connection
export async function initDB() {
  if (db) return db

  sqliteConnection = new SQLiteConnection(CapacitorSQLite)

  try {
    db = await sqliteConnection.createConnection(DB_NAME, false, 'no-encryption', 1, false)
    await db.open()
    console.log('DB: Connection created and opened')
  } catch (e) {
    console.log('DB create error, trying to retrieve existing:', e.message)
    // Connection might already exist, try to retrieve it
    try {
      db = await sqliteConnection.retrieveConnection(DB_NAME)
      const isOpen = await db.isDBOpen().catch(() => false)
      if (!isOpen) await db.open()
      console.log('DB: Retrieved existing connection')
    } catch (e2) {
      console.error('DB init failed:', e2)
      throw e2
    }
  }

  // Create tables using execute() for proper transaction handling
  const createTables = `
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS trucks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_number TEXT NOT NULL,
      driver_name TEXT,
      capacity_tons REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      truck_id INTEGER NOT NULL,
      lot_number TEXT NOT NULL,
      material_id INTEGER,
      weight_tons REAL DEFAULT 0,
      notes TEXT,
      date TEXT NOT NULL,
      delivered_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id),
      FOREIGN KEY (truck_id) REFERENCES trucks(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );
    CREATE TABLE IF NOT EXISTS stats_cache (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_deliveries_site ON deliveries(site_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_truck ON deliveries(truck_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);
    CREATE INDEX IF NOT EXISTS idx_deliveries_lot ON deliveries(site_id, lot_number);
  `

  await db.execute(createTables)
  console.log('DB: Tables created successfully')
  return db
}

// Get database instance
export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.')
  }
  return db
}

// Close database connection
export async function closeDB() {
  if (db) {
    await sqliteConnection.closeConnection(DB_NAME)
    db = null
  }
}

// ─── Sites CRUD ──────────────────────────────────────────────────────────────
export async function getSites() {
  if (!db) await initDB()
  const result = await db.query('SELECT * FROM sites ORDER BY name')
  return result.values || []
}

export async function getSite(id) {
  if (!db) await initDB()
  const result = await db.query('SELECT * FROM sites WHERE id = ?', [id])
  return result.values?.[0] || null
}

export async function createSite(data) {
  if (!db) await initDB()
  const result = await db.run(
    'INSERT INTO sites (name, location) VALUES (?, ?)',
    [data.name, data.location || null]
  )
  return { ...data, id: result.lastId, created_at: new Date().toISOString() }
}

export async function updateSite(id, data) {
  if (!db) await initDB()
  const fields = []
  const values = []
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.location !== undefined) { fields.push('location = ?'); values.push(data.location) }
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  await db.run(`UPDATE sites SET ${fields.join(', ')} WHERE id = ?`, values)
  return { id, ...data }
}

export async function deleteSite(id) {
  if (!db) await initDB()
  await db.run('DELETE FROM sites WHERE id = ?', [id])
}

// ─── Trucks CRUD ─────────────────────────────────────────────────────────────
export async function getTrucks(status) {
  if (!db) await initDB()
  let query = 'SELECT * FROM trucks ORDER BY plate_number'
  let params = []
  if (status) {
    query = 'SELECT * FROM trucks WHERE status = ? ORDER BY plate_number'
    params = [status]
  }
  const result = await db.query(query, params)
  return result.values || []
}

export async function getTruck(id) {
  if (!db) await initDB()
  const result = await db.query('SELECT * FROM trucks WHERE id = ?', [id])
  return result.values?.[0] || null
}

export async function createTruck(data) {
  if (!db) await initDB()
  const result = await db.run(
    'INSERT INTO trucks (plate_number, driver_name, capacity_tons, status) VALUES (?, ?, ?, ?)',
    [data.plate_number, data.driver_name || null, data.capacity_tons || 0, data.status || 'active']
  )
  return { ...data, id: result.lastId, created_at: new Date().toISOString() }
}

export async function updateTruck(id, data) {
  if (!db) await initDB()
  const fields = []
  const values = []
  if (data.plate_number !== undefined) { fields.push('plate_number = ?'); values.push(data.plate_number) }
  if (data.driver_name !== undefined) { fields.push('driver_name = ?'); values.push(data.driver_name) }
  if (data.capacity_tons !== undefined) { fields.push('capacity_tons = ?'); values.push(data.capacity_tons) }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status) }
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  await db.run(`UPDATE trucks SET ${fields.join(', ')} WHERE id = ?`, values)
  return { id, ...data }
}

export async function deleteTruck(id) {
  if (!db) await initDB()
  // Soft delete: set status to archived
  await db.run("UPDATE trucks SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id])
}

export async function reactivateTruck(id) {
  if (!db) await initDB()
  await db.run("UPDATE trucks SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id])
}

// ─── Materials CRUD ──────────────────────────────────────────────────────────
export async function getMaterials() {
  if (!db) await initDB()
  const result = await db.query('SELECT * FROM materials ORDER BY name')
  return result.values || []
}

export async function getMaterial(id) {
  if (!db) await initDB()
  const result = await db.query('SELECT * FROM materials WHERE id = ?', [id])
  return result.values?.[0] || null
}

export async function createMaterial(data) {
  if (!db) await initDB()
  const result = await db.run(
    'INSERT INTO materials (name) VALUES (?)',
    [data.name]
  )
  return { ...data, id: result.lastId, created_at: new Date().toISOString() }
}

export async function updateMaterial(id, data) {
  if (!db) await initDB()
  await db.run('UPDATE materials SET name = ? WHERE id = ?', [data.name, id])
  return { id, ...data }
}

export async function deleteMaterial(id) {
  if (!db) await initDB()
  await db.run('DELETE FROM materials WHERE id = ?', [id])
}

// ─── Deliveries CRUD ─────────────────────────────────────────────────────────
export async function getDeliveries(params = {}) {
  if (!db) await initDB()
  const { site_id, page = 1, limit = 20, search, material_id, start, end } = params

  let whereClauses = []
  let whereValues = []

  if (site_id) {
    whereClauses.push('d.site_id = ?')
    whereValues.push(site_id)
  }
  if (material_id) {
    whereClauses.push('d.material_id = ?')
    whereValues.push(material_id)
  }
  if (start) {
    whereClauses.push('d.date >= ?')
    whereValues.push(start)
  }
  if (end) {
    whereClauses.push('d.date <= ?')
    whereValues.push(end)
  }
  if (search) {
    whereClauses.push('(d.lot_number LIKE ? OR t.plate_number LIKE ?)')
    whereValues.push(`%${search}%`, `%${search}%`)
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM deliveries d LEFT JOIN trucks t ON d.truck_id = t.id ${whereSQL}`
  const countResult = await db.query(countQuery, whereValues)
  const total = countResult.values?.[0]?.total || 0

  // Get paginated results with joins
  const offset = (page - 1) * limit
  const dataQuery = `
    SELECT d.*, t.plate_number, t.driver_name, m.name as material_name, s.name as site_name
    FROM deliveries d
    LEFT JOIN trucks t ON d.truck_id = t.id
    LEFT JOIN materials m ON d.material_id = m.id
    LEFT JOIN sites s ON d.site_id = s.id
    ${whereSQL}
    ORDER BY d.delivered_at DESC
    LIMIT ? OFFSET ?
  `

  const dataValues = [...whereValues, limit, offset]
  const result = await db.query(dataQuery, dataValues)

  return {
    deliveries: result.values || [],
    total,
    pages: Math.ceil(total / limit),
    page
  }
}

export async function getDelivery(id) {
  if (!db) await initDB()
  const result = await db.query(`
    SELECT d.*, t.plate_number, t.driver_name, m.name as material_name, s.name as site_name
    FROM deliveries d
    LEFT JOIN trucks t ON d.truck_id = t.id
    LEFT JOIN materials m ON d.material_id = m.id
    LEFT JOIN sites s ON d.site_id = s.id
    WHERE d.id = ?
  `, [id])
  return result.values?.[0] || null
}

export async function createDelivery(data) {
  if (!db) await initDB()
  const result = await db.run(
    `INSERT INTO deliveries (site_id, truck_id, lot_number, material_id, weight_tons, notes, date, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.site_id,
      data.truck_id,
      data.lot_number,
      data.material_id || null,
      data.weight_tons || 0,
      data.notes || null,
      data.date,
      data.delivered_at || new Date().toISOString()
    ]
  )
  return { ...data, id: result.lastId }
}

export async function updateDelivery(id, data) {
  if (!db) await initDB()
  const fields = []
  const values = []
  if (data.site_id !== undefined) { fields.push('site_id = ?'); values.push(data.site_id) }
  if (data.truck_id !== undefined) { fields.push('truck_id = ?'); values.push(data.truck_id) }
  if (data.lot_number !== undefined) { fields.push('lot_number = ?'); values.push(data.lot_number) }
  if (data.material_id !== undefined) { fields.push('material_id = ?'); values.push(data.material_id) }
  if (data.weight_tons !== undefined) { fields.push('weight_tons = ?'); values.push(data.weight_tons) }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes) }
  if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date) }
  if (data.delivered_at !== undefined) { fields.push('delivered_at = ?'); values.push(data.delivered_at) }
  values.push(id)

  await db.run(`UPDATE deliveries SET ${fields.join(', ')} WHERE id = ?`, values)
  return { id, ...data }
}

export async function deleteDelivery(id) {
  if (!db) await initDB()
  await db.run('DELETE FROM deliveries WHERE id = ?', [id])
}

export async function checkLot(siteId, date, lotNumber) {
  if (!db) await initDB()
  const result = await db.query(
    'SELECT * FROM deliveries WHERE site_id = ? AND date = ? AND lot_number = ?',
    [siteId, date, lotNumber]
  )
  const existing = result.values?.[0] || null
  return { duplicate: !!existing, existing }
}

export async function getNextLot(truckId, date) {
  if (!db) await initDB()
  // Get truck plate number
  const truck = await getTruck(truckId)
  if (!truck) return { nextSeq: 1 }

  // Find the highest sequence number for this truck on this date
  const pattern = `${truck.plate_number}-${date}-%`
  const result = await db.query(
    `SELECT lot_number FROM deliveries WHERE lot_number LIKE ? ORDER BY lot_number DESC LIMIT 1`,
    [pattern]
  )

  const lastLot = result.values?.[0]?.lot_number
  if (!lastLot) return { nextSeq: 1 }

  const parts = lastLot.split('-')
  const lastSeq = parseInt(parts[parts.length - 1], 10) || 0
  return { nextSeq: lastSeq + 1 }
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getDailyStats(siteId, date) {
  if (!db) await initDB()
  const result = await db.query(
    `SELECT COUNT(*) as total_lots, COALESCE(SUM(weight_tons), 0) as total_tons
     FROM deliveries WHERE site_id = ? AND date = ?`,
    [siteId, date]
  )
  const stats = result.values?.[0] || { total_lots: 0, total_tons: 0 }
  return { stats }
}

export async function getCount() {
  if (!db) await initDB()
  const result = await db.query('SELECT COUNT(*) as count FROM deliveries')
  return { count: result.values?.[0]?.count || 0 }
}

export async function getAllTimeStats() {
  if (!db) await initDB()
  const result = await db.query('SELECT COALESCE(SUM(weight_tons), 0) as total_tons FROM deliveries')
  return { total_tons: result.values?.[0]?.total_tons || 0 }
}

export async function getRangeStats(siteId, start, end, materialId) {
  if (!db) await initDB()
  
  try {
    // Grand totals - simple query
    let grandSql = 'SELECT COUNT(*) as total_lots, COALESCE(SUM(weight_tons), 0) as total_tons FROM deliveries WHERE site_id = ? AND date >= ? AND date <= ?'
    let grandParams = [siteId, start, end]
    if (materialId) { grandSql += ' AND material_id = ?'; grandParams.push(materialId) }
    
    const grandResult = await db.query(grandSql, grandParams)
    const grand = grandResult.values?.[0] || { total_lots: 0, total_tons: 0 }

    // Daily - simple query  
    let dailySql = 'SELECT date, COUNT(*) as lots, COALESCE(SUM(weight_tons), 0) as tons FROM deliveries WHERE site_id = ? AND date >= ? AND date <= ?'
    let dailyParams = [siteId, start, end]
    if (materialId) { dailySql += ' AND material_id = ?'; dailyParams.push(materialId) }
    dailySql += ' GROUP BY date ORDER BY date'
    
    const dailyResult = await db.query(dailySql, dailyParams)
    const daily = dailyResult.values || []

    // By truck - needs JOIN
    let truckSql = `SELECT t.plate_number, t.driver_name, COUNT(*) as lots, COALESCE(SUM(d.weight_tons), 0) as tons
      FROM deliveries d JOIN trucks t ON d.truck_id = t.id
      WHERE d.site_id = ? AND d.date >= ? AND d.date <= ?`
    let truckParams = [siteId, start, end]
    if (materialId) { truckSql += ' AND d.material_id = ?'; truckParams.push(materialId) }
    truckSql += ' GROUP BY t.id, t.plate_number, t.driver_name ORDER BY tons DESC'
    
    const truckResult = await db.query(truckSql, truckParams)
    const byTruck = truckResult.values || []

    return { daily, byTruck, grand }
  } catch(e) {
    console.error('getRangeStats error:', e)
    return { daily: [], byTruck: [], grand: { total_lots: 0, total_tons: 0 } }
  }
}

// ─── User Authentication ─────────────────────────────────────────────────────
// Simple password hash using crypto.subtle (SHA-256)
async function hashPassword(password) {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    console.log('hashPassword: generated hash for password length', password.length)
    return hash
  } catch (e) {
    console.error('hashPassword failed:', e)
    throw new Error('Password hashing failed: ' + e.message)
  }
}

export async function createUser(username, password) {
  if (!db) await initDB()
  const passwordHash = await hashPassword(password)
  console.log('createUser: inserting user:', username, 'with hash:', passwordHash.substring(0, 16) + '...')
  try {
    const result = await db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    )
    console.log('createUser: insert result:', result)
    // Get the user we just created
    const queryResult = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )
    console.log('createUser: query result:', queryResult)
    const user = queryResult.values?.[0]
    if (!user) throw new Error('Failed to create user - no user found after insert')
    return { id: user.id, username: user.username, created_at: user.created_at }
  } catch (e) {
    console.error('createUser error:', e)
    throw e
  }
}

export async function verifyUser(username, password) {
  if (!db) await initDB()
  try {
    const passwordHash = await hashPassword(password)
    console.log('verifyUser: checking username:', username, 'hash:', passwordHash.substring(0, 16) + '...')
    const result = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )
    console.log('verifyUser: query result:', result)
    const user = result.values?.[0] || null
    if (!user) {
      console.log('verifyUser: user not found')
      return { valid: false, user: null, error: 'User not found' }
    }
    console.log('verifyUser: found user, stored hash:', user.password_hash?.substring(0, 16) + '...')
    // Check password
    const hashMatch = user.password_hash === passwordHash
    console.log('verifyUser: hash match:', hashMatch)
    if (!hashMatch) return { valid: false, user: null, error: 'Invalid password' }
    return { valid: true, user: { id: user.id, username: user.username, created_at: user.created_at } }
  } catch (e) {
    console.error('verifyUser error:', e)
    return { valid: false, user: null, error: e.message }
  }
}

export async function updateUserPassword(username, newPassword) {
  if (!db) await initDB()
  const passwordHash = await hashPassword(newPassword)
  await db.run(
    'UPDATE users SET password_hash = ? WHERE username = ?',
    [passwordHash, username]
  )
  return { success: true }
}

export async function getUserByUsername(username) {
  if (!db) await initDB()
  const result = await db.query(
    'SELECT * FROM users WHERE username = ?',
    [username]
  )
  const user = result.values?.[0] || null
  return user ? { id: user.id, username: user.username, created_at: user.created_at } : null
}

export async function hasAnyUser() {
  if (!db) await initDB()
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM users')
    const count = result.values?.[0]?.count || 0
    console.log('hasAnyUser: count =', count)
    return count > 0
  } catch (e) {
    console.error('hasAnyUser error:', e)
    // If table doesn't exist, assume no users
    if (e.message?.includes('no such table')) {
      return false
    }
    throw e
  }
}

// Debug: get all users (for testing)
export async function debugGetAllUsers() {
  if (!db) throw new Error('DB not initialized')
  try {
    const result = await db.query('SELECT id, username, created_at FROM users')
    return result.values || []
  } catch (e) {
    console.error('debugGetAllUsers error:', e)
    throw e
  }
}

// ─── Device ID / Activation ──────────────────────────────────────────────────
export function storeDeviceId(deviceId) {
  localStorage.setItem('stp_token', deviceId)
}

export function getDeviceId() {
  return localStorage.getItem('stp_token')
}

export function storeActivationCode(code) {
  localStorage.setItem('stp_code', code)
}

export function getActivationCode() {
  return localStorage.getItem('stp_code')
}

export function isActivated() {
  return !!getActivationCode()
}

// ─── Database Reset ──────────────────────────────────────────────────────────
export async function resetAllData() {
  if (!db) await initDB()
  await db.run('DELETE FROM deliveries')
  await db.run('DELETE FROM sites')
  await db.run('DELETE FROM trucks')
  await db.run('DELETE FROM materials')
  await db.run('DELETE FROM stats_cache')
}

// ─── Backup / Restore ────────────────────────────────────────────────────────
export async function exportDatabase() {
  if (!db) await initDB()
  // Export all tables to JSON
  const sites = await getSites()
  const trucks = await getTrucks()
  const materials = await getMaterials()
  const deliveriesResult = await db.query('SELECT * FROM deliveries')
  const deliveries = deliveriesResult.values || []

  const backupData = {
    version: 1,
    exported_at: new Date().toISOString(),
    data: { sites, trucks, materials, deliveries }
  }

  const filename = `soil-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
  const jsonString = JSON.stringify(backupData, null, 2)

  // Try Directory.Documents first (more accessible to users on Android)
  try {
    const result = await Filesystem.writeFile({
      path: filename,
      data: jsonString,
      directory: Directory.Documents,
      encoding: 'utf8'
    })
    console.log('Backup saved to Documents:', result.uri)
    return { success: true, uri: result.uri, filename, location: 'Documents' }
  } catch (e) {
    console.error('Documents write failed, trying Data directory:', e)

    // Fallback to app's Data directory
    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: jsonString,
        directory: Directory.Data,
        encoding: 'utf8'
      })
      console.log('Backup saved to Data:', result.uri)
      return { success: true, uri: result.uri, filename, location: 'App Data' }
    } catch (e2) {
      console.error('Data directory write failed:', e2)

      // Final fallback: create blob and trigger web download
      try {
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        console.log('Backup downloaded via blob')
        return { success: true, filename, location: 'Download' }
      } catch (e3) {
        console.error('All backup methods failed:', e3)
        throw new Error('Failed to save backup: ' + e3.message)
      }
    }
  }
}

// Export to PDF (simple HTML-based PDF generation)
export async function exportToPDF(siteId, start, end, materialId, siteName, reportData) {
  const html = generateReportHTML(siteName, start, end, reportData)
  const filename = `report-${start}-to-${end}.html`

  // Write HTML to cache directory
  await Filesystem.writeFile({
    path: filename,
    data: html,
    directory: Directory.Cache,
    encoding: 'utf8'
  })

  const fileUri = await Filesystem.getUri({ path: filename, directory: Directory.Cache })

  // Open the HTML file in a new window for printing
  const printWindow = window.open(fileUri.uri, '_blank')
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print()
    })
  }

  return { success: true, filename }
}

// Export to Excel (CSV format)
export async function exportToExcel(siteId, start, end, materialId, reportData) {
  const deliveries = reportData.deliveries || []

  // Create CSV content
  const headers = ['Date', 'Truck', 'Driver', 'Lot #', 'Material', 'Tons', 'Notes']
  const rows = deliveries.map(d => [
    d.date,
    d.plate_number || '',
    d.driver_name || '',
    d.lot_number || '',
    d.material_name || '',
    d.weight_tons != null ? d.weight_tons.toFixed(1) : '0.0',
    (d.notes || '').replace(/"/g, '""')
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const filename = `report-${start}-to-${end}.xlsx`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return { success: true, filename }
}

// Export to CSV
export async function exportToCSV(siteId, start, end, materialId, reportData) {
  return exportToExcel(siteId, start, end, materialId, reportData)
}

// Helper to generate HTML for report
function generateReportHTML(siteName, start, end, reportData) {
  const grand = reportData.grand || { total_lots: 0, total_tons: 0 }
  const daily = reportData.daily || []
  const byTruck = reportData.byTruck || []

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Report: ${siteName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card h3 { margin: 0; font-size: 24px; }
    .summary-card p { margin: 5px 0 0; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>📊 Report: ${siteName}</h1>
  <p>Period: ${start} to ${end}</p>

  <div class="summary">
    <div class="summary-card">
      <h3>${grand.total_lots}</h3>
      <p>Total Lots</p>
    </div>
    <div class="summary-card">
      <h3>${grand.total_tons.toFixed(1)}</h3>
      <p>Total Tons</p>
    </div>
    <div class="summary-card">
      <h3>${byTruck.length}</h3>
      <p>Trucks</p>
    </div>
  </div>

  <h2>Daily Breakdown</h2>
  <table>
    <tr><th>Date</th><th>Lots</th><th>Tons</th></tr>
    ${daily.map(d => `<tr><td>${d.date}</td><td>${d.lots}</td><td>${d.tons.toFixed(1)}</td></tr>`).join('')}
  </table>

  <h2>By Truck</h2>
  <table>
    <tr><th>Truck</th><th>Driver</th><th>Lots</th><th>Tons</th></tr>
    ${byTruck.map(t => `<tr><td>${t.plate_number}</td><td>${t.driver_name || ''}</td><td>${t.lots}</td><td>${t.tons.toFixed(1)}</td></tr>`).join('')}
  </table>
</body>
</html>
  `
}

export async function importDatabase(data) {
  if (!db) await initDB()
  if (!data || !data.data) throw new Error('Invalid backup data')

  // Clear existing data
  await resetAllData()

  // Import in order (respecting foreign keys)
  for (const site of data.data.sites || []) {
    await db.run(
      'INSERT INTO sites (id, name, location, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [site.id, site.name, site.location, site.created_at, site.updated_at]
    )
  }

  for (const truck of data.data.trucks || []) {
    await db.run(
      'INSERT INTO trucks (id, plate_number, driver_name, capacity_tons, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [truck.id, truck.plate_number, truck.driver_name, truck.capacity_tons, truck.status, truck.created_at, truck.updated_at]
    )
  }

  for (const material of data.data.materials || []) {
    await db.run(
      'INSERT INTO materials (id, name, created_at) VALUES (?, ?, ?)',
      [material.id, material.name, material.created_at]
    )
  }

  for (const delivery of data.data.deliveries || []) {
    await db.run(
      `INSERT INTO deliveries (id, site_id, truck_id, lot_number, material_id, weight_tons, notes, date, delivered_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [delivery.id, delivery.site_id, delivery.truck_id, delivery.lot_number, delivery.material_id, delivery.weight_tons, delivery.notes, delivery.date, delivery.delivered_at, delivery.created_at]
    )
  }
}

// Import database from a file picked via file picker (web fallback)
export async function importDatabaseFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async function(e) {
      try {
        const data = JSON.parse(e.target.result)
        await importDatabase(data)
        resolve({ success: true })
      } catch (e) {
        reject(new Error('Import failed: ' + e.message))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

// Pick and import backup file using Capacitor Filesystem Picker
export async function pickAndImportDatabase() {
  try {
    // Use Capacitor's file picker (available via @capacitor/filesystem or native picker)
    // For Android, we'll use the native file picker through Capacitor
    const { FilePicker } = await import('@capacitor/filesystem')

    const result = await FilePicker.pick({
      types: [{ mimeTypes: ['application/json'] }],
      multiple: false
    })

    if (!result.files || result.files.length === 0) {
      throw new Error('No file selected')
    }

    const file = result.files[0]
    // Read the file content
    const readResult = await Filesystem.readFile({
      path: file.path
    })

    const data = JSON.parse(readResult.data)
    await importDatabase(data)
    return { success: true }
  } catch (e) {
    // Fallback: try web-style file input if Capacitor FilePicker fails
    console.log('FilePicker failed, may need web fallback:', e.message)
    throw e
  }
}
