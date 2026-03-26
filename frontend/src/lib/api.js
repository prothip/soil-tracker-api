// For Capacitor Android: use remote backend URL
// For browser dev: use relative URL (via Vite proxy)
const BASE = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3002/api'
  : (typeof window !== 'undefined' ? window.location.origin + '/api' : '/api');

function getToken() {
  return localStorage.getItem('stp_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text, raw: true }; }
  if (res.status === 401) {
    localStorage.removeItem('stp_token');
    localStorage.removeItem('stp_user');
    window.location.hash = '#login';
    throw new Error(data.error || 'Unauthorized');
  }
  if (!res.ok) throw new Error(data.error || (`Request failed: ${res.status}`));
  return data;
}

export const api = {
  licenses: {
    list: () => request('GET', '/licenses/list'),
    generate: () => request('GET', '/licenses/generate'),
    revoke: (id) => request('PUT', `/licenses/${id}/revoke`),
    activate: (id) => request('PUT', `/licenses/${id}/activate`),
    delete: (id) => request('DELETE', `/licenses/${id}`),
  },
  auth: {
    login: (u, p) => request('POST', '/auth/login', { username: u, password: p }),
    me: () => request('GET', '/auth/me'),
    changePassword: (data) => request('PUT', '/auth/password', data),
    createUser: (data) => request('POST', '/auth/users', data),
  },
  sites: {
    list: () => request('GET', '/sites'),
    create: (d) => request('POST', '/sites', d),
    update: (id, d) => request('PUT', `/sites/${id}`, d),
    delete: (id) => request('DELETE', `/sites/${id}`),
  },
  trucks: {
    list: (status) => request('GET', `/trucks${status ? '?status=' + status : ''}`),
    create: (d) => request('POST', '/trucks', d),
    update: (id, d) => request('PUT', `/trucks/${id}`, d),
    delete: (id) => request('DELETE', `/trucks/${id}`),
  },
  materials: {
    list: () => request('GET', '/materials'),
    create: (d) => request('POST', '/materials', d),
    update: (id, d) => request('PUT', `/materials/${id}`, d),
    delete: (id) => request('DELETE', `/materials/${id}`),
  },
  deliveries: {
    list: (params) => {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
      const q = new URLSearchParams(clean).toString();
      return request('GET', `/deliveries?${q}`);
    },
    create: (d) => request('POST', '/deliveries', d),
    update: (id, d) => request('PUT', `/deliveries/${id}`, d),
    delete: (id) => request('DELETE', `/deliveries/${id}`),
    checkLot: (siteId, date, lotNumber) =>
      request('GET', `/deliveries/check-lot?site_id=${siteId}&date=${date}&lot_number=${encodeURIComponent(lotNumber)}`),
    nextLot: (truckId, date) =>
      request('GET', `/deliveries/next-lot?truck_id=${truckId}&date=${date}`),
  },
  stats: {
    daily: (siteId, date) => request('GET', `/stats/daily?site_id=${siteId}&date=${date}`),
    range: (siteId, start, end, materialId) => {
      let q = `?site_id=${siteId}&start=${start}&end=${end}`;
      if (materialId) q += `&material_id=${materialId}`;
      return request('GET', `/stats/range${q}`);
    },
    count: () => request('GET', '/stats/count'),
  },
  export: {
    csv: (siteId, start, end, materialId) => {
      if (!siteId || siteId === 'undefined') return null;
      const token = getToken();
      let q = `?site_id=${siteId}&start=${start}&end=${end}`;
      if (materialId) q += `&material_id=${materialId}`;
      if (token) q += `&token=${encodeURIComponent(token)}`;
      return `${BASE}/export/csv${q}`;
    },
  },
  backup: {
    download: () => {
      const token = getToken();
      const filename = `soil-tracker-backup-${new Date().toISOString().split('T')[0]}.db`;
      const url = BASE + '/backup';
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      const headers = { Authorization: `Bearer ${token}` };
      fetch(url, { headers })
        .then(res => {
          if (!res.ok) throw new Error('Backup failed');
          return res.blob();
        })
        .then(blob => {
          a.href = URL.createObjectURL(blob);
          a.click();
          URL.revokeObjectURL(a.href);
        })
        .catch(err => { throw err; });
    },
  },
  reset: {
    confirm: () => request('POST', '/reset'),
  },
};
