// Local IndexedDB Database for Offline-First Soil Tracker Pro (Web Platform)
// Uses IndexedDB instead of CapacitorSQLite for browser compatibility

const DB_NAME = 'soil_tracker_db'
const DB_VERSION = 1
let db = null

// ─── IndexedDB Wrapper ───────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(new Error('IndexedDB open failed: ' + request.error))
    request.onsuccess = () => { db = request.result; resolve(db) }
    request.onupgradeneeded = (e) => {
      const database = e.target.result
      if (!database.objectStoreNames.contains('sites')) {
        database.createObjectStore('sites', { keyPath: 'id', autoIncrement: true })
      }
      if (!database.objectStoreNames.contains('trucks')) {
        const store = database.createObjectStore('trucks', { keyPath: 'id', autoIncrement: true })
        store.createIndex('plate_number', 'plate_number', { unique: true })
      }
      if (!database.objectStoreNames.contains('materials')) {
        const store = database.createObjectStore('materials', { keyPath: 'id', autoIncrement: true })
        store.createIndex('name', 'name', { unique: true })
      }
      if (!database.objectStoreNames.contains('deliveries')) {
        const store = database.createObjectStore('deliveries', { keyPath: 'id', autoIncrement: true })
        store.createIndex('site_id', 'site_id')
        store.createIndex('truck_id', 'truck_id')
        store.createIndex('date', 'date')
        store.createIndex('site_lot_date', ['site_id', 'lot_number', 'date'], { unique: false })
      }
      if (!database.objectStoreNames.contains('stats_cache')) {
        database.createObjectStore('stats_cache', { keyPath: 'key' })
      }
      if (!database.objectStoreNames.contains('users')) {
        const store = database.createObjectStore('users', { keyPath: 'id', autoIncrement: true })
        store.createIndex('username', 'username', { unique: true })
      }
    }
  })
}

function idbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGetAll(storeName, indexName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = indexName ? store.index(indexName) : store
    const req = index.getAll(key)
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

function idbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(value)
    req.onsuccess = () => resolve(req)
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.delete(key)
    req.onsuccess = () => resolve(req)
    req.onerror = () => reject(req.error)
  })
}

function idbCount(storeName, indexName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = indexName ? store.index(indexName) : store
    const req = index.count(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ─── Init ────────────────────────────────────────────────────────────────────
export async function initDB() {
  if (db) return db
  await openDB()
  return db
}

export function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.')
  return db
}

export async function closeDB() {
  if (db) { db.close(); db = null }
}

// ─── Sites CRUD ──────────────────────────────────────────────────────────────
export async function getSites() {
  if (!db) await initDB()
  const rows = await idbGetAll('sites')
  return rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export async function getSite(id) {
  if (!db) await initDB()
  return await idbGet('sites', id) || null
}

export async function createSite(data) {
  if (!db) await initDB()
  const record = { name: data.name, location: data.location || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await idbPut('sites', record)
  return { ...record, id: record.id }
}

export async function updateSite(id, data) {
  if (!db) await initDB()
  const existing = await idbGet('sites', id)
  if (!existing) return null
  const updated = { ...existing, ...data, updated_at: new Date().toISOString() }
  await idbPut('sites', updated)
  return { id, ...data }
}

export async function deleteSite(id) {
  if (!db) await initDB()
  await idbDelete('sites', id)
}

// ─── Trucks CRUD ─────────────────────────────────────────────────────────────
export async function getTrucks(status) {
  if (!db) await initDB()
  const rows = await idbGetAll('trucks')
  const filtered = status ? rows.filter(r => r.status === status) : rows
  return filtered.sort((a, b) => (a.plate_number || '').localeCompare(b.plate_number || ''))
}

export async function getTruck(id) {
  if (!db) await initDB()
  return await idbGet('trucks', id) || null
}

export async function createTruck(data) {
  if (!db) await initDB()
  const record = { plate_number: data.plate_number, driver_name: data.driver_name || null, capacity_tons: data.capacity_tons || 0, status: data.status || 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await idbPut('trucks', record)
  return { ...record, id: record.id }
}

export async function updateTruck(id, data) {
  if (!db) await initDB()
  const existing = await idbGet('trucks', id)
  if (!existing) return null
  const updated = { ...existing, ...data, updated_at: new Date().toISOString() }
  await idbPut('trucks', updated)
  return { id, ...data }
}

export async function deleteTruck(id) {
  if (!db) await initDB()
  const existing = await idbGet('trucks', id)
  if (existing) await idbPut('trucks', { ...existing, status: 'archived', updated_at: new Date().toISOString() })
}

export async function reactivateTruck(id) {
  if (!db) await initDB()
  const existing = await idbGet('trucks', id)
  if (existing) await idbPut('trucks', { ...existing, status: 'active', updated_at: new Date().toISOString() })
}

// ─── Materials CRUD ──────────────────────────────────────────────────────────
export async function getMaterials() {
  if (!db) await initDB()
  const rows = await idbGetAll('materials')
  return rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export async function getMaterial(id) {
  if (!db) await initDB()
  return await idbGet('materials', id) || null
}

export async function createMaterial(data) {
  if (!db) await initDB()
  const record = { name: data.name, created_at: new Date().toISOString() }
  await idbPut('materials', record)
  return { ...record, id: record.id }
}

export async function updateMaterial(id, data) {
  if (!db) await initDB()
  const existing = await idbGet('materials', id)
  if (!existing) return null
  const updated = { ...existing, name: data.name }
  await idbPut('materials', updated)
  return { id, ...data }
}

export async function deleteMaterial(id) {
  if (!db) await initDB()
  await idbDelete('materials', id)
}

// ─── Deliveries CRUD ─────────────────────────────────────────────────────────
export async function getDeliveries(params = {}) {
  if (!db) await initDB()
  const { site_id, page = 1, limit = 20, search, material_id, start, end } = params
  let rows = await idbGetAll('deliveries')

  if (site_id) rows = rows.filter(r => r.site_id == site_id)
  if (material_id) rows = rows.filter(r => r.material_id == material_id)
  if (start) rows = rows.filter(r => r.date >= start)
  if (end) rows = rows.filter(r => r.date <= end)
  if (search) {
    const s = search.toLowerCase()
    rows = rows.filter(r => (r.lot_number || '').toLowerCase().includes(s) || (r.plate_number || '').toLowerCase().includes(s))
  }

  rows.sort((a, b) => (b.delivered_at || '').localeCompare(a.delivered_at || ''))
  const total = rows.length
  const offset = (page - 1) * limit
  const pageRows = rows.slice(offset, offset + limit)

  // Enrich with site/truck/material names
  const sites = await idbGetAll('sites')
  const trucks = await idbGetAll('trucks')
  const materials = await idbGetAll('materials')
  const siteMap = Object.fromEntries(sites.map(s => [s.id, s]))
  const truckMap = Object.fromEntries(trucks.map(t => [t.id, t]))
  const matMap = Object.fromEntries(materials.map(m => [m.id, m]))

  const enriched = pageRows.map(d => ({
    ...d,
    plate_number: truckMap[d.truck_id]?.plate_number,
    driver_name: truckMap[d.truck_id]?.driver_name,
    material_name: matMap[d.material_id]?.name,
    site_name: siteMap[d.site_id]?.name
  }))

  return { deliveries: enriched, total, pages: Math.ceil(total / limit), page }
}

export async function getDelivery(id) {
  if (!db) await initDB()
  return await idbGet('deliveries', id) || null
}

export async function createDelivery(data) {
  if (!db) await initDB()
  const record = {
    site_id: data.site_id, truck_id: data.truck_id, lot_number: data.lot_number,
    material_id: data.material_id || null, weight_tons: data.weight_tons || 0,
    notes: data.notes || null, date: data.date,
    delivered_at: data.delivered_at || new Date().toISOString(),
    created_at: new Date().toISOString()
  }
  await idbPut('deliveries', record)
  return { ...record, id: record.id }
}

export async function updateDelivery(id, data) {
  if (!db) await initDB()
  const existing = await idbGet('deliveries', id)
  if (!existing) return null
  const updated = { ...existing, ...data }
  await idbPut('deliveries', updated)
  return { id, ...data }
}

export async function deleteDelivery(id) {
  if (!db) await initDB()
  await idbDelete('deliveries', id)
}

export async function checkLot(siteId, date, lotNumber) {
  if (!db) await initDB()
  const rows = await idbGetAll('deliveries')
  const existing = rows.find(r => r.site_id == siteId && r.date === date && r.lot_number === lotNumber)
  return { duplicate: !!existing, existing }
}

export async function getNextLot(truckId, date) {
  if (!db) await initDB()
  const truck = await getTruck(truckId)
  if (!truck) return { nextSeq: 1 }
  const rows = await idbGetAll('deliveries')
  const pattern = `${truck.plate_number}-${date}-`
  const matching = rows.filter(r => (r.lot_number || '').startsWith(pattern))
  if (matching.length === 0) return { nextSeq: 1 }
  const seqs = matching.map(r => {
    const parts = r.lot_number.split('-')
    return parseInt(parts[parts.length - 1], 10) || 0
  })
  return { nextSeq: Math.max(...seqs) + 1 }
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getDailyStats(siteId, date) {
  if (!db) await initDB()
  const rows = await idbGetAll('deliveries')
  const filtered = rows.filter(r => r.site_id == siteId && r.date === date)
  const total_lots = filtered.length
  const total_tons = filtered.reduce((sum, r) => sum + (r.weight_tons || 0), 0)
  return { stats: { total_lots, total_tons } }
}

export async function getCount() {
  if (!db) await initDB()
  const rows = await idbGetAll('deliveries')
  return { count: rows.length }
}

export async function getAllTimeStats() {
  if (!db) await initDB()
  const rows = await idbGetAll('deliveries')
  const total_tons = rows.reduce((sum, r) => sum + (r.weight_tons || 0), 0)
  return { total_tons }
}

export async function getRangeStats(siteId, start, end, materialId) {
  if (!db) await initDB()
  const rows = await idbGetAll('deliveries')
  const trucks = await idbGetAll('trucks')
  const truckMap = Object.fromEntries(trucks.map(t => [t.id, t]))

  let filtered = rows.filter(r => r.site_id == siteId && r.date >= start && r.date <= end)
  if (materialId) filtered = filtered.filter(r => r.material_id == materialId)

  const total_lots = filtered.length
  const total_tons = filtered.reduce((sum, r) => sum + (r.weight_tons || 0), 0)

  const dailyMap = {}
  for (const r of filtered) {
    if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date, lots: 0, tons: 0 }
    dailyMap[r.date].lots++
    dailyMap[r.date].tons += r.weight_tons || 0
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  const truckMap2 = {}
  for (const r of filtered) {
    const t = truckMap[r.truck_id]
    const key = r.truck_id
    if (!truckMap2[key]) truckMap2[key] = { plate_number: t?.plate_number || '', driver_name: t?.driver_name || '', lots: 0, tons: 0 }
    truckMap2[key].lots++
    truckMap2[key].tons += r.weight_tons || 0
  }
  const byTruck = Object.values(truckMap2).sort((a, b) => b.tons - a.tons)

  return { daily, byTruck, grand: { total_lots, total_tons } }
}

// ─── Users ──────────────────────────────────────────────────────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createUser(username, password) {
  if (!db) await initDB()
  const passwordHash = await hashPassword(password)
  const rows = await idbGetAll('users')
  if (rows.find(r => r.username === username)) throw new Error('UNIQUE constraint failed')
  const record = { username, password_hash: passwordHash, created_at: new Date().toISOString() }
  await idbPut('users', record)
  return { id: record.id, username: record.username, created_at: record.created_at }
}

export async function verifyUser(username, password) {
  if (!db) await initDB()
  const rows = await idbGetAll('users')
  const user = rows.find(r => r.username === username) || null
  if (!user) return { valid: false, user: null, error: 'User not found' }
  const hashMatch = user.password_hash === await hashPassword(password)
  if (!hashMatch) return { valid: false, user: null, error: 'Invalid password' }
  return { valid: true, user: { id: user.id, username: user.username, created_at: user.created_at } }
}

export async function updateUserPassword(username, newPassword) {
  if (!db) await initDB()
  const rows = await idbGetAll('users')
  const user = rows.find(r => r.username === username)
  if (!user) return { success: false }
  user.password_hash = await hashPassword(newPassword)
  await idbPut('users', user)
  return { success: true }
}

export async function getUserByUsername(username) {
  if (!db) await initDB()
  const rows = await idbGetAll('users')
  const user = rows.find(r => r.username === username) || null
  return user ? { id: user.id, username: user.username, created_at: user.created_at } : null
}

export async function hasAnyUser() {
  if (!db) await initDB()
  const rows = await idbGetAll('users')
  return rows.length > 0
}

// ─── Device / Activation ─────────────────────────────────────────────────────
export function storeDeviceId(deviceId) { localStorage.setItem('stp_token', deviceId) }
export function getDeviceId() { return localStorage.getItem('stp_token') }
export function storeActivationCode(code) { localStorage.setItem('stp_code', code) }
export function getActivationCode() { return localStorage.getItem('stp_code') }
export function isActivated() { return !!getActivationCode() }

// ─── Reset ───────────────────────────────────────────────────────────────────
export async function resetAllData() {
  if (!db) await initDB()
  const tx = db.transaction(['deliveries', 'sites', 'trucks', 'materials', 'stats_cache'], 'readwrite')
  await Promise.all([
    new Promise((res, rej) => { const s = tx.objectStore('deliveries').clear(); s.onsuccess = res; s.onerror = rej }),
    new Promise((res, rej) => { const s = tx.objectStore('sites').clear(); s.onsuccess = res; s.onerror = rej }),
    new Promise((res, rej) => { const s = tx.objectStore('trucks').clear(); s.onsuccess = res; s.onerror = rej }),
    new Promise((res, rej) => { const s = tx.objectStore('materials').clear(); s.onsuccess = res; s.onerror = rej }),
    new Promise((res, rej) => { const s = tx.objectStore('stats_cache').clear(); s.onsuccess = res; s.onerror = rej }),
  ])
}

// ─── Backup / Restore ────────────────────────────────────────────────────────
export async function exportDatabase() {
  if (!db) await initDB()
  const backupData = {
    version: 1, exported_at: new Date().toISOString(),
    data: {
      sites: await idbGetAll('sites'),
      trucks: await idbGetAll('trucks'),
      materials: await idbGetAll('materials'),
      deliveries: await idbGetAll('deliveries')
    }
  }
  const jsonString = JSON.stringify(backupData, null, 2)
  const filename = `soil-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
  return { success: true, filename, location: 'Download' }
}

export async function importDatabase(data) {
  if (!db) await initDB()
  if (!data?.data) throw new Error('Invalid backup data')
  await resetAllData()
  const tx = db.transaction(['sites', 'trucks', 'materials', 'deliveries'], 'readwrite')
  for (const s of data.data.sites || []) await new Promise((res, rej) => { const r = tx.objectStore('sites').put(s); r.onsuccess = res; r.onerror = rej })
  for (const t of data.data.trucks || []) await new Promise((res, rej) => { const r = tx.objectStore('trucks').put(t); r.onsuccess = res; r.onerror = rej })
  for (const m of data.data.materials || []) await new Promise((res, rej) => { const r = tx.objectStore('materials').put(m); r.onsuccess = res; r.onerror = rej })
  for (const d of data.data.deliveries || []) await new Promise((res, rej) => { const r = tx.objectStore('deliveries').put(d); r.onsuccess = res; r.onerror = rej })
  return { success: true }
}

export async function importDatabaseFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result)
        await importDatabase(data)
        resolve({ success: true })
      } catch (e) { reject(new Error('Import failed: ' + e.message)) }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export async function pickAndImportDatabase() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async () => {
      if (!input.files[0]) { reject(new Error('No file selected')); return }
      try { await importDatabaseFromFile(input.files[0]); resolve({ success: true }) }
      catch (e) { reject(e) }
    }
    input.click()
  })
}

// ─── PDF / Excel Stubs (web) ─────────────────────────────────────────────────
export async function exportToPDF() { throw new Error('PDF export not supported in web PWA') }
export async function exportToExcel() { return exportDatabase() }
export async function exportToCSV() { return exportDatabase() }
