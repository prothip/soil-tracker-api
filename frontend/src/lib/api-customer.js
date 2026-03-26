// Customer app: uses device tokens via activation code
const STP_API = 'https://cope-calls-fotos-springer.trycloudflare.com'

export { STP_API }

function getToken() {
  return localStorage.getItem('stp_token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${STP_API}${path}`, opts)
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { error: text } }
  if (res.status === 401) {
    localStorage.removeItem('stp_token')
    localStorage.removeItem('stp_code')
    window.location.reload()
    throw new Error('Session expired')
  }
  if (!res.ok) throw new Error(data.error || (`Request failed: ${res.status}`))
  return data
}

export const api = {
  auth: {
    login: (u, p) => request('POST', '/api/auth/login', { username: u, password: p }),
    me: () => request('GET', '/api/auth/me'),
    changePassword: (data) => request('PUT', '/api/auth/password', data),
    createUser: (data) => request('POST', '/api/auth/users', data),
  },
  sites: {
    list: () => request('GET', '/api/sites'),
    create: (d) => request('POST', '/api/sites', d),
    update: (id, d) => request('PUT', `/api/sites/${id}`, d),
    delete: (id) => request('DELETE', `/api/sites/${id}`),
  },
  trucks: {
    list: (status) => request('GET', `/api/trucks${status ? '?status=' + status : ''}`),
    create: (d) => request('POST', '/api/trucks', d),
    update: (id, d) => request('PUT', `/api/trucks/${id}`, d),
    delete: (id) => request('DELETE', `/api/trucks/${id}`),
  },
  materials: {
    list: () => request('GET', '/api/materials'),
    create: (d) => request('POST', '/api/materials', d),
    update: (id, d) => request('PUT', `/api/materials/${id}`, d),
    delete: (id) => request('DELETE', `/api/materials/${id}`),
  },
  deliveries: {
    list: (params) => {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
      const q = new URLSearchParams(clean).toString()
      return request('GET', `/api/deliveries?${q}`)
    },
    create: (d) => request('POST', '/api/deliveries', d),
    update: (id, d) => request('PUT', `/api/deliveries/${id}`, d),
    delete: (id) => request('DELETE', `/api/deliveries/${id}`),
    checkLot: (siteId, date, lotNumber) =>
      request('GET', `/api/deliveries/check-lot?site_id=${siteId}&date=${date}&lot_number=${encodeURIComponent(lotNumber)}`),
    nextLot: (truckId, date) =>
      request('GET', `/api/deliveries/next-lot?truck_id=${truckId}&date=${date}`),
  },
  stats: {
    daily: (siteId, date) => request('GET', `/api/stats/daily?site_id=${siteId}&date=${date}`),
    range: (siteId, start, end, materialId) => {
      let q = `?site_id=${siteId}&start=${start}&end=${end}`
      if (materialId) q += `&material_id=${materialId}`
      return request('GET', `/api/stats/range${q}`)
    },
    count: () => request('GET', '/api/stats/count'),
    alltime: () => request('GET', '/api/stats/alltime'),
  },
  export: {
    csv: (siteId, start, end, materialId) => {
      if (!siteId || siteId === 'undefined') return null
      const token = getToken()
      let q = `?site_id=${siteId}&start=${start}&end=${end}`
      if (materialId) q += `&material_id=${materialId}`
      if (token) q += `&token=${encodeURIComponent(token)}`
      return `${STP_API}/api/export/csv${q}`
    },
  },
  backup: {
    download: async () => {
      const token = getToken()
      const filename = `soil-tracker-backup-${new Date().toISOString().split('T')[0]}.db`
      try {
        const res = await fetch(`${STP_API}/api/backup`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error('Backup failed: ' + res.status)
        const blob = await res.blob()
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        // Convert blob to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const binary = String.fromCharCode(...new Uint8Array(reader.result))
            resolve(btoa(binary))
          }
          reader.onerror = reject
          reader.readAsArrayBuffer(blob)
        })
        // Write to cache directory
        const fileUri = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        })
        // Open the file using Capacitor Share API if available, else fallback
        try {
          const { Share } = await import('@capacitor/share')
          await Share.share({ url: fileUri.uri, title: 'Soil Tracker Backup' })
        } catch {
          // Fallback: use window.open with file URI
          const a = document.createElement('a')
          a.href = fileUri.uri
          a.download = filename
          a.click()
        }
      } catch (e) {
        // Browser fallback
        const a = document.createElement('a')
        a.href = `${STP_API}/api/backup?token=${encodeURIComponent(token || '')}`
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    },
  },
  reset: {
    confirm: () => request('POST', '/api/reset'),
  },
}
