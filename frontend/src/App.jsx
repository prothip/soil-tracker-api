import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import {
  LayoutDashboard, ClipboardList, Truck, MoreHorizontal,
  LogOut, Plus, Search, ChevronDown, Pencil, Trash2,
  Download, X, Check, AlertCircle, Sun, Moon, RefreshCw, CalendarDays,
  Copy, Ban, Wifi, WifiOff, Upload
} from 'lucide-react'
import DatePicker from './components/DatePicker'
import { api, STP_API } from './lib/api-customer'
import { VERSION } from './version'
const QrScanner = lazy(() => import('./components/QrScanner'))
const TruckQrModal = lazy(() => import('./components/TruckQrModal'))

// ─── Export helpers ─────────────────────────────────────────────────────────
function downloadUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function buildExportUrl(path, params) {
  const token = localStorage.getItem('stp_token')
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'undefined')
  )
  if (token) clean.token = token
  return `${STP_API}/api/export/${path}?${new URLSearchParams(clean).toString()}`
}

// ─── Activation Screen ─────────────────────────────────────────────────────────
function ActivationScreen({ onSuccess }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  function format(v) {
    const c = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16)
    const parts = []
    for (let i = 0; i < c.length; i += 4) parts.push(c.slice(i, i + 4))
    return parts.join('-')
  }

  async function handle(e) {
    e.preventDefault()
    if (code.replace(/-/g, '').length < 16) { setErr('Please enter a complete activation code'); return }
    setErr(''); setLoading(true)
    try {
      const res = await fetch(`${STP_API}/api/auth/device-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      localStorage.setItem('stp_token', data.token)
      localStorage.setItem('stp_code', code)
      onSuccess(data.token)
    } catch (e) {
      setErr(e.message || 'Activation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-text tracking-tight">Soil Tracker <span className="text-accent">Pro</span></div>
          <p className="text-muted text-sm mt-1">Enter your activation code to continue</p>
        </div>
        <form onSubmit={handle} className="bg-surface rounded-2xl shadow-sm border border-border p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} /><span>{err}</span>
          </div>}
          <div>
            <label className="text-sm font-medium text-text block mb-1.5">Activation Code</label>
            <input
              value={code} onChange={e => { setCode(format(e.target.value)); setErr('') }}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full h-12 px-3 rounded-xl border border-border bg-surface text-center text-lg font-mono tracking-widest placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
              autoComplete="off" autoCapitalize="characters"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-11 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50">
            {loading ? 'Activating...' : 'Activate'}
          </button>
          <p className="text-xs text-muted text-center">Contact your administrator for an activation code</p>
        </form>
      </div>
    </div>
  )
}

// ─── Auth ───────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotCode, setForgotCode] = useState('')
  const [forgotStep, setForgotStep] = useState(1) // 1=enter code, 2=enter new password
  const [newPass, setNewPass] = useState('')
  const [newUser, setNewUser] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')

  async function handle(e) {
    e.preventDefault()
    if (!u.trim()) { setErr('Please enter username'); return }
    if (!p) { setErr('Please enter password'); return }
    setErr('')
    setLoading(true)
    try {
      const res = await fetch(`${STP_API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Login failed — check credentials')
      localStorage.setItem('stp_token', data.token)
      localStorage.setItem('stp_user', JSON.stringify(data.user))
      onLogin(data.user)
    } catch (e) {
      setErr(e.message || 'Login failed — check credentials')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotSubmit() {
    if (forgotStep === 1) {
      // Verify activation code
      if (!forgotCode || forgotCode.replace(/-/g,'').length < 16) {
        setForgotMsg('Enter a valid activation code')
        return
      }
      setForgotMsg('Verifying...')
      try {
        const res = await fetch(`${STP_API}/api/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: forgotCode })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.valid) throw new Error('Invalid activation code')
        setForgotStep(2)
        setForgotMsg('Code verified! Now set your new username and password.')
      } catch (e) {
        setForgotMsg(e.message || 'Invalid activation code')
      }
    } else {
      // Reset password with code
      if (!newUser.trim() || !newPass) {
        setForgotMsg('Enter new username and password')
        return
      }
      if (newPass.length < 4) {
        setForgotMsg('Password must be at least 4 characters')
        return
      }
      setForgotMsg('Resetting...')
      try {
        const res = await fetch(`${STP_API}/api/auth/reset-with-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: forgotCode, username: newUser, password: newPass })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Reset failed')
        setForgotMsg('Password reset! You can now login.')
        setShowForgot(false)
        setForgotStep(1)
        setForgotCode('')
        setNewUser('')
        setNewPass('')
      } catch (e) {
        setForgotMsg(e.message || 'Reset failed')
      }
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-text tracking-tight">Soil Tracker <span className="text-accent">Pro</span></div>
          <p className="text-muted text-sm mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={handle} className="bg-surface rounded-2xl shadow-sm border border-border p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} /><span>{err}</span>
          </div>}
          <div>
            <label className="text-sm font-medium text-text block mb-1.5">Username</label>
            <input value={u} onChange={e => setU(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="admin" />
          </div>
          <div>
            <label className="text-sm font-medium text-text block mb-1.5">Password</label>
            <input type="password" value={p} onChange={e => setP(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full h-11 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          {!showForgot ? (
            <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline text-center">
              Forgot password?
            </button>
          ) : (
            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-text">Reset Password</p>
              <p className="text-xs text-muted">Use your <b>activation code</b> to reset credentials. Your activation code is printed on your license document.</p>
              {forgotStep === 1 ? (
                <>
                  <input value={forgotCode} onChange={e => setForgotCode(e.target.value.toUpperCase())} maxLength={20}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm uppercase tracking-wider"
                    placeholder="XXXX-XXXX-XXXX-XXXX" />
                  {forgotMsg && <p className={`text-xs ${forgotMsg.includes('verified')||forgotMsg.includes('reset') ? 'text-success' : 'text-danger'}`}>{forgotMsg}</p>}
                  <button type="button" onClick={handleForgotSubmit}
                    className="w-full h-9 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90">
                    Verify Code
                  </button>
                </>
              ) : (
                <>
                  <input value={newUser} onChange={e => setNewUser(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm" placeholder="New username" />
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm" placeholder="New password (min 4 chars)" />
                  {forgotMsg && <p className="text-xs text-danger">{forgotMsg}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowForgot(false); setForgotStep(1); setForgotCode(''); setForgotMsg('') }}
                      className="flex-1 h-9 border border-border text-muted text-sm rounded-lg">Cancel</button>
                    <button type="button" onClick={handleForgotSubmit}
                      className="flex-1 h-9 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90">Reset</button>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-muted text-center">Default: admin / admin123</p>
          <div className="border-t border-border pt-3 mt-2">
            <p className="text-xs text-muted text-center mb-2">Starting fresh on this device?</p>
            <button type="button" onClick={async () => {
              if (!confirm('This will delete ALL data (deliveries, trucks, sites) on this server. Are you sure?')) return
              try {
                const token = localStorage.getItem('stp_token')
                await fetch(`${STP_API}/api/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ confirm: 'RESET' }) })
                localStorage.removeItem('stp_token'); localStorage.removeItem('stp_user'); localStorage.removeItem('stp_code'); localStorage.removeItem('stp_site_id')
                window.location.reload()
              } catch { alert('Reset failed') }
            }} className="w-full h-9 border border-danger/30 text-danger text-sm font-medium rounded-lg hover:bg-danger/5 transition-all">
              Start Fresh — Clear All Data
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 animate-slide-up ${
          t.type === 'success' ? 'bg-success text-white' : t.type === 'error' ? 'bg-danger text-white' : 'bg-text text-white'
        }`}>
          {t.type === 'success' && <Check size={15} />}
          {t.type === 'error' && <AlertCircle size={15} />}
          {t.msg}
        </div>
      ))}
    </div>
  )
}

let toastId = 0
function useToast() {
  const [toasts, setToasts] = useState([])
  const show = useCallback((msg, type = 'success') => {
    const id = ++toastId
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])
  return { toasts, show }
}

// ─── Site Selector ──────────────────────────────────────────────────────────
function SiteSelector({ sites, siteId, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const current = sites.find(s => s.id === siteId)
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg px-3 h-9">
        {current?.name || 'Select Site'} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-surface border border-border rounded-xl shadow-lg z-50 min-w-[200px] overflow-hidden">
          {sites.map(s => (
            <button key={s.id} onClick={() => { onChange(s.id); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-bg transition-colors ${s.id === siteId ? 'bg-primary/5 text-primary font-medium' : 'text-text'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Topbar ─────────────────────────────────────────────────────────────────
function Topbar({ user, onLogout, dark, onToggleDark, online }) {
  return (
    <header className="bg-surface border-b border-border px-4 py-3 sticky top-0 z-40 flex items-center justify-between gap-3">
      <div className="text-base font-bold text-text tracking-tight">Soil Tracker <span className="text-accent">Pro</span></div>
      <div className="flex items-center gap-2">
        {online === false && <span className="text-xs text-red-400 flex items-center gap-1"><WifiOff size={12} /> Offline</span>}
        {online === true && <span className="text-xs text-emerald-400 flex items-center gap-1"><Wifi size={12} /></span>}
        <button onClick={onToggleDark} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-border transition-colors">
          {dark ? <Moon size={16} className="text-accent" /> : <Sun size={16} className="text-muted" />}
        </button>
        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-xs font-semibold text-primary">{user?.username?.[0]?.toUpperCase()}</span>
        </div>
        <button onClick={onLogout} className="text-muted hover:text-danger transition-colors"><LogOut size={18} /></button>
      </div>
    </header>
  )
}

// ─── Bottom Nav ─────────────────────────────────────────────────────────────
const TABS = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'log', label: 'Log', Icon: ClipboardList },
  { key: 'trucks', label: 'Trucks', Icon: Truck },
  { key: 'more', label: 'More', Icon: MoreHorizontal },
]

function BottomNav({ tab, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[640px] mx-auto bg-surface border-t border-border z-40">
      <div className="flex">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => onChange(key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors relative ${tab === key ? 'text-primary' : 'text-muted'}`}>
            <Icon size={20} />
            {label}
            {tab === key && <div className="absolute top-0 left-3 right-3 h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─── Summary Card ───────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color = 'text-text' }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className={`text-2xl font-bold ${color} tabular-nums`}>{value ?? '—'}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted/70 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-text">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Delivery Form ───────────────────────────────────────────────────────────
function DeliveryForm({ sites, siteId, trucks, materials, onSubmit, loading, initial }) {
  const [site, setSite] = useState(initial?.site_id || siteId || '')
  const [truck, setTruck] = useState(initial?.truck_id || '')
  const [lot, setLot] = useState(initial?.lot_number || '')
  const [mat, setMat] = useState(initial?.material_id || '')
  const [wt, setWt] = useState(initial?.weight_tons || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [err, setErr] = useState({})
  const [dupWarning, setDupWarning] = useState(null)
  const [checkingDup, setCheckingDup] = useState(false)
  const [lotEdited, setLotEdited] = useState(false)

  useEffect(() => { if (siteId && !initial) setSite(siteId) }, [siteId])

  // Auto-fetch next lot when truck changes
  useEffect(() => {
    if (!initial?.lot_number && truck) {
      const effectiveDate = initial?.date || new Date().toLocaleDateString('en-CA')
      setLotEdited(false)
      api.deliveries.nextLot(Number(truck), effectiveDate).then(res => {
        const truckRow = trucks.find(t => t.id === Number(truck))
        if (truckRow) {
          const autoLot = `${truckRow.plate_number}-${effectiveDate}-${String(res.nextSeq).padStart(3, '0')}`
          setLot(autoLot)
        }
      }).catch(() => {})
    }
  }, [truck, initial?.date])

  function validate() {
    const e = {}
    if (!site) e.site = 'Required'
    if (!truck) e.truck = 'Required'
    if (!lot.trim()) e.lot = 'Required'
    return e
  }

  async function handleSubmitForm(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErr(e); return }
    setErr({})

    if (!initial && site && lot.trim()) {
      setCheckingDup(true)
      try {
        const res = await api.deliveries.checkLot(site, initial?.date || new Date().toLocaleDateString('en-CA'), lot.trim())
        if (res.duplicate) {
          setDupWarning({ existing: res.existing })
          setCheckingDup(false)
          return
        }
      } catch {}
      setCheckingDup(false)
    }

    setDupWarning(null)
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const localISO = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const payload = { site_id: Number(site), truck_id: Number(truck), lot_number: lot, material_id: Number(mat)||null, weight_tons: Number(wt)||0, notes, date: initial?.date || new Date().toLocaleDateString('en-CA'), delivered_at: localISO }
    await onSubmit(payload)
    if (!initial) { setLot(''); setWt(''); setNotes(''); setMat('') }
  }

  return (
    <form onSubmit={handleSubmitForm} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Site</label>
          <select value={site} onChange={e => setSite(e.target.value)}
            className={`w-full h-11 px-3 rounded-lg border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${err.site ? 'border-danger' : 'border-border'}`}>
            <option value="">Select site</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {err.site && <p className="text-xs text-danger mt-1">{err.site}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Truck</label>
          <select value={truck} onChange={e => setTruck(e.target.value)}
            className={`w-full h-11 px-3 rounded-lg border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${err.truck ? 'border-danger' : 'border-border'}`}>
            <option value="">Select truck</option>
            {trucks.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.plate_number} — {t.driver_name}</option>)}
          </select>
          {err.truck && <p className="text-xs text-danger mt-1">{err.truck}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Lot Number</label>
          <div className="flex items-center gap-1">
            <input value={lot} onChange={e => { setLot(e.target.value.toUpperCase()); setLotEdited(true) }} maxLength={20}
              className={`flex-1 h-11 px-3 rounded-lg border bg-surface text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/30 ${err.lot ? 'border-danger' : 'border-border'}`}
              placeholder="LOT-001" />
            {!lotEdited && lot && <span className="text-xs text-muted/50 flex-shrink-0">(auto)</span>}
          </div>
          {err.lot && <p className="text-xs text-danger mt-1">{err.lot}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Material</label>
          <select value={mat} onChange={e => setMat(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Select material</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">Weight (tons)</label>
        <input type="number" value={wt} onChange={e => setWt(e.target.value)} step="0.1" min="0"
          className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="0.0" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          placeholder="Optional notes..." />
      </div>
      {dupWarning && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">Duplicate lot number</p>
              <p className="text-xs text-muted mt-0.5">
                Lot <strong>{dupWarning.existing?.lot_number}</strong> already exists for this site.
                Do you want to add it anyway?
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={async () => {
              setDupWarning(null)
              setCheckingDup(true)
              const now = new Date()
              const pad = n => String(n).padStart(2, '0')
              const localISO = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
              await onSubmit({ site_id: Number(site), truck_id: Number(truck), lot_number: lot, material_id: Number(mat)||null, weight_tons: Number(wt)||0, notes, date: initial?.date || new Date().toLocaleDateString('en-CA'), delivered_at: localISO })
              if (!initial) { setLot(''); setWt(''); setNotes(''); setMat('') }
              setCheckingDup(false)
            }}
              className="flex-1 h-9 bg-warning text-white text-xs font-semibold rounded-lg hover:bg-warning/90 active:scale-[0.98] transition-all">
              Yes, add anyway
            </button>
            <button type="button" onClick={() => setDupWarning(null)}
              className="flex-1 h-9 bg-border text-text text-xs font-semibold rounded-lg hover:bg-border/80 active:scale-[0.98] transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}
      <button type="submit" disabled={loading || checkingDup}
        className="w-full h-12 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50">
        {checkingDup ? 'Checking...' : loading ? 'Saving...' : initial ? 'Update Delivery' : '+ Log Delivery'}
      </button>
    </form>
  )
}

// ─── Dashboard Page ─────────────────────────────────────────────────────────────
function DashboardPage({ siteId, sites, trucks, onChangeSite }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const { show: showToast } = useToast()

  const today = new Date().toLocaleDateString('en-CA')
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toLocaleDateString('en-CA') })()

  useEffect(() => {
    if (!siteId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.stats.daily(siteId, today),
      api.stats.count(),
      api.stats.alltime(),
      api.stats.range(siteId, weekStart, today),
    ]).then(([d, count, allTime, week]) => {
      setStats({ ...d, grand_lots: count.count, grand_tons: allTime.total_tons || 0, weekStats: week.daily || [] })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [siteId])

  const todayDeliveries = stats?.stats?.total_lots || 0
  const todayTons = stats?.stats?.total_tons || 0
  const totalDeliveries = stats?.grand_lots || 0
  const totalTons = stats?.grand_tons || 0
  const activeTrucks = trucks.filter(t => t.status === 'active').length

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Dashboard</h2>
        <button onClick={() => window.location.reload()} className="text-muted hover:text-text">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Site selector */}
      {sites.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Viewing:</span>
          <SiteSelector sites={sites} siteId={siteId} onChange={onChangeSite} />
        </div>
      )}

      {!siteId ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <div className="text-3xl mb-2">📍</div>
          <p className="text-muted text-sm">Select a site to view dashboard</p>
          <p className="text-xs text-muted/60 mt-1">Go to More → Sites to add a site first</p>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="text-xs text-muted mb-1">Today</div>
            <div className="text-xs text-muted">{new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Today's Deliveries" value={loading ? '—' : todayDeliveries} sub="lots logged" />
            <SummaryCard label="Today's Tons" value={loading ? '—' : todayTons.toFixed(1)} sub={`${todayTons > 0 ? '+' : ''}${todayTons.toFixed(1)}t`} color="text-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="All Time — Lots" value={totalDeliveries} sub="total deliveries" color="text-text" />
            <SummaryCard label="All Time — Tons" value={totalTons.toFixed(1)} sub="tonnes logged" color="text-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Active Trucks" value={activeTrucks} sub="registered" color="text-success" />
            <SummaryCard label="Sites" value={sites.length} sub="total" color="text-muted" />
          </div>

          {/* Weekly chart */}
          {stats?.weekStats?.length > 0 && (() => {
            const maxTons = Math.max(...stats.weekStats.map(d => d.tons), 1)
            return (
              <div className="bg-surface rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-text mb-3">Last 7 Days</h3>
                <div className="grid grid-cols-7 gap-1.5 h-28 items-end">
                  {stats.weekStats.map(d => {
                    const h = d.tons > 0 ? Math.max(8, d.tons / maxTons * 96) : 4
                    const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
                    return (
                      <div key={d.date} className="flex flex-col items-center gap-1 min-w-0">
                        <div className="w-full bg-primary rounded-sm" style={{ height: `${h}px`, minHeight: '4px' }} />
                        <span className="text-xs text-muted whitespace-nowrap">{dayLabel}</span>
                        <span className="text-xs font-medium text-text whitespace-nowrap">{d.tons.toFixed(0)}t</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

// ─── Log Page ────────────────────────────────────────────────────────────────
function LogPage({ siteId, sites, trucks, materials, onRefresh, showQr, setShowQr, onQrScan, scannedTruckId, onScannedTruckUsed }) {
  const [deliveries, setDeliveries] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [matFilter, setMatFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const { show: showToast } = useToast()
  const requestRef = useRef(0)

  function load(p) {
    const pageNum = p ?? page
    if (siteId == null || siteId === 0) return
    const requestId = ++requestRef.current
    setLoading(true)
    setPage(pageNum)
    api.deliveries.list({
      site_id: siteId, page: pageNum, limit: 20,
      search: search || undefined, material_id: matFilter || undefined
    }).then(d => {
      if (requestId !== requestRef.current) return
      setDeliveries(d.deliveries || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
    }).catch(e => { if (requestId === requestRef.current) showToast('Failed to load', 'error') })
      .finally(() => { if (requestId === requestRef.current) setLoading(false) })
  }

  useEffect(() => {
    const delay = search ? 400 : 0
    const t = setTimeout(() => load(1), delay)
    return () => clearTimeout(t)
  }, [siteId, matFilter, search])

  async function handleSubmit(data) {
    setSubmitting(true)
    try {
      if (editing?.id) {
        await api.deliveries.update(editing.id, data)
        showToast('Delivery updated')
      } else {
        await api.deliveries.create(data)
        showToast('Delivery logged')
      }
      setShowForm(false)
      setEditing(null)
      load(1)
      if (onRefresh) onRefresh()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this delivery?')) return
    try {
      await api.deliveries.delete(id)
      showToast('Delivery deleted')
      load(page)
      if (onRefresh) onRefresh()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Called when form is submitted or closed — notify parent scanned truck was used
  function handleFormClose() {
    if (scannedTruckId) onScannedTruckUsed()
  }

  // When scannedTruckId arrives (from QR scan), pre-fill form with that truck
  useEffect(() => {
    if (scannedTruckId) {
      // Toggle form closed then open to force Modal remount (React only remounts on key change)
      setShowForm(false)
      setEditing({ truck_id: scannedTruckId })
      setTimeout(() => setShowForm(true), 50)
    }
  }, [scannedTruckId])

  return (
    <div className="p-4 space-y-3 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text">Deliveries</h2>
          <p className="text-xs text-muted">{total} total delivery{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQr(true)}
            className="h-10 px-3 bg-accent/10 text-accent text-sm font-semibold rounded-lg flex items-center gap-1.5 hover:bg-accent/20 active:scale-[0.98] transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Scan
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="h-10 px-4 bg-primary text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 hover:bg-primary/90 active:scale-[0.98] transition-all">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lot or truck..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={matFilter} onChange={e => setMatFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">All</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? 'Edit Delivery' : 'Log Delivery'}>
        <DeliveryForm key={editing?.id || 'new'} sites={sites} siteId={siteId} trucks={trucks} materials={materials}
          onSubmit={handleSubmit} loading={submitting} initial={editing} />
      </Modal>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted text-sm">Loading...</div>
        ) : deliveries.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-muted text-sm">No deliveries yet</p>
            <p className="text-xs text-muted/60 mt-1">Tap + to log your first delivery</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-bg">
                  <th className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-4 py-2">Time</th>
                  <th className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-4 py-2">Truck</th>
                  <th className="text-right text-xs font-semibold text-muted uppercase tracking-wide px-4 py-2">Tons</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map(d => (
                  <tr key={d.id} className="hover:bg-bg/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted">
                      <div>{d.date}</div>
                      <div>{d.delivered_at ? d.delivered_at.split('T')[1]?.slice(0,5) : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-text">{d.plate_number}</div>
                      <div className="text-xs text-muted">{d.driver_name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-mono text-muted/70">{d.lot_number}</span>
                        {d.material_name && <span className="text-xs bg-bg text-muted px-1.5 py-0.5 rounded">{d.material_name}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-text tabular-nums">{d.weight_tons > 0 ? d.weight_tons : '—'}</span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditing(d); setShowForm(true) }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(d.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
                <button onClick={() => load(page - 1)} disabled={page <= 1}
                  className="text-sm text-primary disabled:opacity-30">← Prev</button>
                <span className="text-xs text-muted">Page {page} of {pages}</span>
                <button onClick={() => load(page + 1)} disabled={page >= pages}
                  className="text-sm text-primary disabled:opacity-30">Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Trucks Page ─────────────────────────────────────────────────────────────
function TrucksPage({ trucks, onRefresh, setShowQrModalFor }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ plate_number: '', driver_name: '', capacity_tons: '' })
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { show: showToast } = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.plate_number.trim()) { setErr('Plate number required'); return }
    setErr('')
    setSubmitting(true)
    try {
      if (editing) {
        await api.trucks.update(editing.id, { ...form, capacity_tons: Number(form.capacity_tons) || 0 })
        showToast('Truck updated')
      } else {
        await api.trucks.create({ ...form, capacity_tons: Number(form.capacity_tons) || 0 })
        showToast('Truck added')
      }
      setShowForm(false)
      setEditing(null)
      setForm({ plate_number: '', driver_name: '', capacity_tons: '' })
      if (onRefresh) onRefresh()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Archive this truck?')) return
    try {
      await api.trucks.delete(id)
      showToast('Truck archived')
      if (onRefresh) onRefresh()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleReactivate(id) {
    try {
      await api.trucks.update(id, { status: 'active' })
      showToast('Truck reactivated')
      if (onRefresh) onRefresh()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  function openEdit(t) {
    setEditing(t)
    setForm({ plate_number: t.plate_number, driver_name: t.driver_name || '', capacity_tons: t.capacity_tons || '' })
    setShowForm(true)
  }

  const active = trucks.filter(t => t.status === 'active')
  const archived = trucks.filter(t => t.status !== 'active')

  return (
    <div className="p-4 space-y-3 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Truck Registry</h2>
        <button onClick={() => { setEditing(null); setForm({ plate_number: '', driver_name: '', capacity_tons: '' }); setShowForm(true) }}
          className="h-9 px-4 bg-primary text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 hover:bg-primary/90 active:scale-[0.98] transition-all">
          <Plus size={16} /> Add Truck
        </button>
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? 'Edit Truck' : 'Add Truck'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {err && <p className="text-sm text-danger">{err}</p>}
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Plate Number *</label>
            <input value={form.plate_number} onChange={e => setForm(f => ({ ...f, plate_number: e.target.value.toUpperCase() }))}
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Driver Name</label>
            <input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Capacity (tons)</label>
            <input type="number" value={form.capacity_tons} onChange={e => setForm(f => ({ ...f, capacity_tons: e.target.value }))} step="0.1" min="0"
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full h-12 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50">
            {submitting ? 'Saving...' : editing ? 'Update Truck' : 'Add Truck'}
          </button>
        </form>
      </Modal>

      <div className="space-y-2">
        {active.length === 0 && archived.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <div className="text-3xl mb-2">🚚</div>
            <p className="text-muted text-sm">No trucks registered</p>
          </div>
        ) : (
          <>
            {active.map(t => (
              <div key={t.id} className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-success/10 text-success">🚚</div>
                    <div>
                      <div className="text-sm font-semibold text-text">{t.plate_number}</div>
                      <div className="text-xs text-muted">{t.driver_name || 'No driver'}</div>
                      {t.capacity_tons > 0 && <span className="text-xs bg-bg text-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">{t.capacity_tons}t capacity</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">active</span>
                    <button onClick={() => setShowQrModalFor(t)} className="h-8 px-2.5 bg-accent/10 text-accent text-xs font-semibold rounded-lg flex items-center gap-1 hover:bg-accent/20 active:scale-[0.98] transition-all">
                      📱 QR
                    </button>
                    <button onClick={() => openEdit(t)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {archived.length > 0 && (
              <>
                <button onClick={() => setShowArchived(a => !a)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted hover:text-text transition-colors">
                  <span>{showArchived ? '▲' : '▼'} Show archived ({archived.length})</span>
                </button>
                {showArchived && archived.map(t => (
                  <div key={t.id} className="bg-surface rounded-xl border border-border p-4 opacity-70">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-muted/10 text-muted">🚚</div>
                        <div>
                          <div className="text-sm font-semibold text-text">{t.plate_number}</div>
                          <div className="text-xs text-muted">{t.driver_name || 'No driver'}</div>
                          {t.capacity_tons > 0 && <span className="text-xs bg-bg text-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">{t.capacity_tons}t capacity</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted/10 text-muted">archived</span>
                        <button onClick={() => handleReactivate(t.id)}
                          className="h-8 px-3 bg-success/10 text-success text-xs font-semibold rounded-lg flex items-center gap-1 hover:bg-success/20 active:scale-[0.98] transition-all">
                          Reactivate
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── More Page ───────────────────────────────────────────────────────────────
function MorePage({ siteId, sites, trucks, materials, onRefreshSites, onRefreshTrucks, onRefreshMaterials, onRefreshAll, user }) {
  const { show: showToast } = useToast()
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [showMatForm, setShowMatForm] = useState(false)
  const [editingMat, setEditingMat] = useState(null)
  const [matForm, setMatForm] = useState({ name: '' })
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetInput, setResetInput] = useState('')
  const [resetting, setResetting] = useState(false)
  const [curPwd, setCurPwd] = useState('')
  const [newUname, setNewUname] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [changingCreds, setChangingCreds] = useState(false)
  const [deliveryCount, setDeliveryCount] = useState(0)
  const restoreRef = useRef()
  const [siteForm, setSiteForm] = useState({ name: '', location: '' })

  useEffect(() => { api.stats.count().then(r => setDeliveryCount(r.count || 0)).catch(() => {}) }, [])

  const today = new Date().toLocaleDateString('en-CA')
  const weekStart = (d => { d.setDate(d.getDate() - 6); return d.toLocaleDateString('en-CA') })(new Date())
  const [repStart, setRepStart] = useState(weekStart)
  const [repEnd, setRepEnd] = useState(today)
  const [repMat, setRepMat] = useState('')
  const [repSite, setRepSite] = useState(siteId || '')
  const [reportData, setReportData] = useState(null)
  const [reportDeliveries, setReportDeliveries] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  async function saveSite(e) {
    e.preventDefault()
    if (!siteForm.name.trim()) return
    try {
      if (editingSite) { await api.sites.update(editingSite.id, siteForm); showToast('Site updated') }
      else { await api.sites.create(siteForm); showToast('Site added') }
      setShowSiteForm(false)
      setEditingSite(null)
      setSiteForm({ name: '', location: '' })
      if (onRefreshSites) onRefreshSites()
    } catch (e) { showToast(e.message, 'error') }
  }

  async function deleteSite(id) {
    if (!confirm('Delete this site? All its deliveries will remain but the site will be removed.')) return
    try { await api.sites.delete(id); showToast('Site deleted'); if (onRefreshSites) onRefreshSites() }
    catch (e) { showToast(e.message, 'error') }
  }

  async function addMat(e) {
    e.preventDefault()
    if (!matForm.name.trim()) return
    try {
      if (editingMat) { await api.materials.update(editingMat.id, { name: matForm.name.trim() }); showToast('Material updated') }
      else { await api.materials.create(matForm); showToast('Material added') }
      setShowMatForm(false)
      setEditingMat(null)
      setMatForm({ name: '' })
      if (onRefreshMaterials) onRefreshMaterials()
    } catch (e) { showToast(e.message, 'error') }
  }

  function openEditMat(m) { setEditingMat(m); setMatForm({ name: m.name }); setShowMatForm(true) }

  async function deleteMat(id) {
    if (!confirm('Delete this material?')) return
    try { await api.materials.delete(id); showToast('Material removed'); if (onRefreshMaterials) onRefreshMaterials() }
    catch (e) { showToast(e.message, 'error') }
  }

  async function loadReport() {
    const s = repSite || siteId
    if (!s) { showToast('Select a site first', 'error'); return }
    setReportLoading(true)
    try {
      const [data, deliveryData] = await Promise.all([
        api.stats.range(s, repStart, repEnd, repMat||undefined),
        api.deliveries.list({ site_id: s, start: repStart, end: repEnd, material_id: repMat||undefined, limit: 500 })
      ])
      setReportData(data)
      setReportDeliveries(deliveryData.deliveries || [])
      setShowReport(true)
    } catch (e) { showToast(e.message, 'error') }
    finally { setReportLoading(false) }
  }

  function handleRestore() {
    const file = restoreRef.current?.files?.[0]
    if (!file) { showToast('No file selected', 'error'); return }
    if (!file.name.endsWith('.db')) { showToast('Select a .db backup file', 'error'); return }
    if (!confirm('This will replace ALL current data with the backup. Are you sure?')) return
    const reader = new FileReader()
    reader.onload = function(e) {
      const base64 = e.target.result.split(',')[1]
      const token = localStorage.getItem('stp_token')
      fetch(`${STP_API}/api/backup/restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ file: base64 }),
      }).then(res => { if (!res.ok) throw new Error('Restore failed'); return res.json() })
        .then(() => { showToast('Database restored — reloading...'); setTimeout(() => window.location.reload(), 1500) })
        .catch(e => showToast(e.message, 'error'))
    }
    reader.readAsDataURL(file)
  }

  async function handleReset() {
    if (resetInput !== 'RESET') { showToast('Type RESET to confirm', 'error'); return }
    setResetting(true)
    try {
      await api.reset.confirm()
      showToast('All deliveries deleted')
      setShowResetForm(false)
      setResetInput('')
      setDeliveryCount(0)
      if (onRefreshAll) onRefreshAll()
    } catch (e) { showToast(e.message, 'error') }
    finally { setResetting(false) }
  }

  return (
    <div className="p-4 space-y-3 pb-6">
      {/* Reports section */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text">📊 Reports & Export</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Site</label>
            <select value={repSite || siteId || ''} onChange={e => setRepSite(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">From</label>
              <DatePicker value={repStart} onChange={setRepStart} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">To</label>
              <DatePicker value={repEnd} onChange={setRepEnd} />
            </div>
          </div>
          <div className="flex gap-2">
            <select value={repMat} onChange={e => setRepMat(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">All materials</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={loadReport} disabled={reportLoading}
              className="h-10 px-4 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50">
              {reportLoading ? 'Loading...' : 'View'}
            </button>
          </div>
        </div>
      </div>

      {/* Report results */}
      {showReport && reportData && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">
                {sites.find(s => s.id == (repSite || siteId))?.name || 'Report'}: {repStart} → {repEnd}
              </h3>
              <p className="text-xs text-muted">{reportData.byTruck?.length || 0} trucks · {reportData.grand?.total_lots || 0} lots · {(reportData.grand?.total_tons || 0).toFixed(1)}t total</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadUrl(buildExportUrl('html', { site_id: repSite || siteId, start: repStart, end: repEnd, material_id: repMat || undefined, site_name: sites.find(s => s.id == (repSite || siteId))?.name || '' }), `report-${repStart}-to-${repEnd}.html`)}
                className="h-9 px-3 bg-primary text-white text-sm font-medium rounded-lg flex items-center gap-1.5 hover:bg-primary/90 active:scale-[0.98] transition-all">
                <Download size={14} /> Print
              </button>
              <button onClick={() => downloadUrl(buildExportUrl('pdf', { site_id: repSite || siteId, start: repStart, end: repEnd, material_id: repMat || undefined }), `report-${repStart}-to-${repEnd}.pdf`)}
                className="h-9 px-3 bg-danger text-white text-sm font-medium rounded-lg flex items-center gap-1.5 hover:bg-danger/90 active:scale-[0.98] transition-all">
                PDF
              </button>
              <button onClick={() => downloadUrl(buildExportUrl('excel', { site_id: repSite || siteId, start: repStart, end: repEnd, material_id: repMat || undefined }), `report-${repStart}-to-${repEnd}.xlsx`)}
                className="h-9 px-3 bg-success text-white text-sm font-medium rounded-lg flex items-center gap-1.5 hover:bg-success/90 active:scale-[0.98] transition-all">
                <Download size={14} /> Excel
              </button>
              <button onClick={() => setShowReport(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
            <div className="p-3 text-center"><div className="text-lg font-bold text-text">{reportData.grand?.total_lots ?? 0}</div><div className="text-xs text-muted">Total Lots</div></div>
            <div className="p-3 text-center"><div className="text-lg font-bold text-primary">{(reportData.grand?.total_tons || 0).toFixed(1)}</div><div className="text-xs text-muted">Total Tons</div></div>
            <div className="p-3 text-center"><div className="text-lg font-bold text-accent">{reportData.byTruck?.length ?? 0}</div><div className="text-xs text-muted">Trucks</div></div>
          </div>

          {reportData.daily?.length > 0 && (
            <div className="border-b border-border">
              <div className="px-4 py-2 bg-bg"><span className="text-xs font-semibold text-muted uppercase tracking-wide">Daily</span></div>
              <div className="flex overflow-x-auto">
                {reportData.daily.map(d => (
                  <div key={d.date} className="flex-1 min-w-[72px] p-3 text-center border-r border-border last:border-r-0">
                    <div className="text-xs text-muted mb-1">{d.date.slice(5)}</div>
                    <div className="text-sm font-bold text-text">{d.lots}</div>
                    <div className="text-xs text-muted">{d.tons.toFixed(1)}t</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportData.byTruck?.length > 0 ? (
            <div className="divide-y divide-border">
              <div className="px-4 py-2 bg-bg flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">By Truck</span>
              </div>
              {reportData.byTruck.map(t => (
                <div key={t.plate_number} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-text">{t.plate_number}</div>
                    <div className="text-xs text-muted">{t.driver_name || ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-text">{t.tons.toFixed(1)}t</div>
                    <div className="text-xs text-muted">{t.lots} lots</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-muted text-sm">No deliveries in this period</div>
          )}

          {reportDeliveries.length > 0 && (
            <div className="divide-y divide-border">
              <div className="px-4 py-2 bg-bg"><span className="text-xs font-semibold text-muted uppercase tracking-wide">All Deliveries</span></div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted text-left">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Truck</th>
                      <th className="px-4 py-2 font-medium">Driver</th>
                      <th className="px-4 py-2 font-medium">Lot #</th>
                      <th className="px-4 py-2 font-medium">Material</th>
                      <th className="px-4 py-2 font-medium text-right">Tons</th>
                      <th className="px-4 py-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {reportDeliveries.map(d => (
                      <tr key={d.id} className="border-t border-border">
                        <td className="px-4 py-2">{d.date}</td>
                        <td className="px-4 py-2 font-medium">{d.plate_number || '—'}</td>
                        <td className="px-4 py-2">{d.driver_name || '—'}</td>
                        <td className="px-4 py-2">{d.lot_number || '—'}</td>
                        <td className="px-4 py-2">{d.material_name || '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold">{d.weight_tons != null ? d.weight_tons.toFixed(1) : '0.0'}</td>
                        <td className="px-4 py-2 text-muted max-w-[120px] truncate">{d.notes || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sites */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">📍 Sites</h3>
          <button onClick={() => { setEditingSite(null); setSiteForm({ name: '', location: '' }); setShowSiteForm(true) }}
            className="text-primary text-sm font-medium">+ Add</button>
        </div>
        {sites.length === 0 ? (
          <div className="p-4 text-center text-muted text-sm">No sites yet</div>
        ) : (
          <div className="divide-y divide-border">
            {sites.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.id === siteId ? 'bg-success' : 'bg-muted/30'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate">{s.name}</div>
                    <div className="text-xs text-muted truncate">{s.location || 'No location'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {s.id === siteId && <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">Active</span>}
                  <button onClick={() => { setEditingSite(s); setSiteForm({ name: s.name, location: s.location || '' }); setShowSiteForm(true) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                    <Pencil size={14} />
                  </button>
                  {s.id !== siteId && (
                    <button onClick={() => deleteSite(s.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Materials */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">🧱 Materials</h3>
          <button onClick={() => { setMatForm({ name: '' }); setShowMatForm(true) }}
            className="text-primary text-sm font-medium">+ Add</button>
        </div>
        <div className="px-4 py-2.5 flex flex-wrap gap-2">
          {materials.map(m => (
            <span key={m.id} className="bg-bg text-text text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 pr-1.5">
              {m.name}
              <button onClick={() => openEditMat(m)} className="text-muted hover:text-primary ml-0.5"><Pencil size={11} /></button>
              <button onClick={() => deleteMat(m.id)} className="text-muted hover:text-danger">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text">⚙️ Settings</h3>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <button onClick={() => { try { api.backup.download() } catch (e) { showToast('Backup failed: ' + e.message, 'error') } }}
            className="w-full h-11 bg-primary/10 text-primary text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/20 active:scale-[0.98] transition-all">
            <Download size={16} /> Backup Database
          </button>
          <input ref={restoreRef} type="file" accept=".db" className="hidden" onChange={handleRestore} />
          <button onClick={() => restoreRef.current?.click()}
            className="w-full h-11 bg-accent/10 text-accent text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-accent/20 active:scale-[0.98] transition-all border border-accent/20">
            <RefreshCw size={16} /> Restore Database
          </button>
          <button onClick={() => { setResetInput(''); setShowResetForm(true) }}
            className="w-full h-11 bg-danger/10 text-danger text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-danger/20 active:scale-[0.98] transition-all border border-danger/20">
            <Trash2 size={16} /> Reset All Data
          </button>
        </div>
      </div>

      {/* Reset confirmation */}
      <Modal open={showResetForm} onClose={() => { setShowResetForm(false); setResetInput('') }} title="Reset All Data">
        <div className="space-y-4">
          <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-danger">This action cannot be undone</p>
                <p className="text-xs text-danger/80 mt-1">All delivery records will be permanently deleted. Trucks, sites, and materials will be preserved.</p>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">
              Type <span className="font-bold text-danger">RESET</span> to confirm
            </label>
            <input value={resetInput} onChange={e => setResetInput(e.target.value.toUpperCase())} placeholder="RESET"
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-danger/30 uppercase"
              autoComplete="off" />
          </div>
          <button onClick={handleReset} disabled={resetInput !== 'RESET' || resetting}
            className="w-full h-12 bg-danger text-white font-semibold rounded-xl hover:bg-danger/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {resetting ? 'Deleting...' : 'Delete All Deliveries'}
          </button>
        </div>
      </Modal>

      {/* Change Username / Password */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text">👤 Change Username / Password</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Current Password *</label>
            <input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} placeholder="Required to authorize change"
              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">New Username</label>
            <input type="text" value={newUname} onChange={e => setNewUname(e.target.value)} placeholder="Leave blank to keep current"
              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">New Password</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Leave blank to keep current"
              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button
            onClick={async () => {
              if (!curPwd) { showToast('Enter current password', 'error'); return }
              if (!newUname.trim() && !newPwd) { showToast('Provide new username or password', 'error'); return }
              setChangingCreds(true)
              try {
                await api.auth.changePassword({ currentPassword: curPwd, newUsername: newUname.trim() || undefined, newPassword: newPwd || undefined })
                showToast('Credentials updated')
                setCurPwd(''); setNewUname(''); setNewPwd('')
              } catch (e) { showToast(e.message, 'error') }
              finally { setChangingCreds(false) }
            }}
            className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            disabled={changingCreds}>
            {changingCreds ? 'Updating...' : 'Change Credentials'}
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="bg-surface rounded-xl border border-border p-4 text-center">
        <div className="text-sm font-semibold text-text">Soil Tracker Pro</div>
        <div className="text-xs text-muted mt-0.5">Version {VERSION} — Built with React + SQLite</div>
        <div className="text-xs text-primary mt-1 font-medium">{deliveryCount.toLocaleString()} total deliveries</div>
      </div>

      {/* Site form modal */}
      <Modal open={showSiteForm} onClose={() => { setShowSiteForm(false); setEditingSite(null) }} title={editingSite ? 'Edit Site' : 'Add Site'}>
        <form onSubmit={saveSite} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Site Name *</label>
            <input value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Location</label>
            <input value={siteForm.location} onChange={e => setSiteForm(f => ({ ...f, location: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button type="submit" className="w-full h-12 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all">
            {editingSite ? 'Update Site' : 'Add Site'}
          </button>
        </form>
      </Modal>

      {/* Material form modal */}
      <Modal open={showMatForm} onClose={() => { setShowMatForm(false); setEditingMat(null); setMatForm({ name: '' }) }}
        title={editingMat ? 'Edit Material' : 'Add Material'}>
        <form onSubmit={addMat} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Material Name *</label>
            <input value={matForm.name} onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button type="submit" className="w-full h-12 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all">
            {editingMat ? 'Update Material' : 'Add Material'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('stp_user')) } catch { return null } })
  const token = localStorage.getItem('stp_token')
  const activated = localStorage.getItem('stp_code')
  const [tab, setTab] = useState('dashboard')
  const [dark, setDark] = useState(() => localStorage.getItem('stp_dark') === '1')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const { toasts, show: showToast } = useToast()

  // Data
  const [sites, setSites] = useState([])
  const [trucks, setTrucks] = useState([])
  const [materials, setMaterials] = useState([])
  const [siteId, setSiteId] = useState(() => Number(localStorage.getItem('stp_site_id')) || 0)
  const [showQr, setShowQr] = useState(false)
  const [showQrModalFor, setShowQrModalFor] = useState(null)
  const [scannedTruckId, setScannedTruckId] = useState(null)

  // Persist site selection
  useEffect(() => { localStorage.setItem('stp_site_id', siteId) }, [siteId])

  // Online/offline detection
  useEffect(() => {
    function handleOnline() { setOnline(true); showToast('Back online', 'success') }
    function handleOffline() { setOnline(false); showToast('You are offline', 'info') }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  // Dark mode
  useEffect(() => {
    if (dark) { document.documentElement.classList.add('dark'); localStorage.setItem('stp_dark', '1') }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('stp_dark', '0') }
  }, [dark])

  // Auto-update check
  useEffect(() => {
    if (!token) return
    fetch(`${STP_API}/api/version`).then(r => r.json()).then(data => {
      if (data.version && data.version !== VERSION) { setUpdateAvailable(true); setUpdateDismissed(false) }
    }).catch(() => {})
  }, [])

  // Load data
  function loadSites() { api.sites.list().then(setSites).catch(() => {}) }
  function loadTrucks() { api.trucks.list().then(setTrucks).catch(() => {}) }
  function loadMaterials() { api.materials.list().then(setMaterials).catch(() => {}) }
  function loadAll() { loadSites(); loadTrucks(); loadMaterials() }

  useEffect(() => { if (token && activated) loadAll() }, [])

  // Auto-select first site
  useEffect(() => {
    if (sites.length > 0 && !siteId) {
      setSiteId(sites[0].id)
    }
  }, [sites])

  // Auth check
  if (!activated && !token) return <ActivationScreen onSuccess={() => window.location.reload()} />
  if (!user && token) return <LoginPage onLogin={setUser} />

  function handleLogout() {
    localStorage.removeItem('stp_token'); localStorage.removeItem('stp_user'); localStorage.removeItem('stp_code')
    window.location.hash = '#login'; window.location.reload()
  }

  function handleUpdateNow() {
    window.location.href = window.location.pathname + '?v=' + Date.now()
  }

  function handleQrScan(result) {
    const found = trucks.find(t => t.plate_number.toLowerCase() === result.toLowerCase())
    if (found) {
      setScannedTruckId(found.id)
      setTab('log')
    } else {
      showToast('Truck not found: ' + result, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-bg max-w-[640px] mx-auto flex flex-col">
      <Topbar user={user} onLogout={handleLogout} dark={dark} onToggleDark={() => setDark(d => !d)} online={online} />

      {/* Auto-update banner */}
      {updateAvailable && !updateDismissed && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between gap-2">
          <span className="text-xs text-primary">A new version is available</span>
          <div className="flex items-center gap-2">
            <button onClick={handleUpdateNow} className="text-xs text-primary font-semibold">Update</button>
            <button onClick={() => setUpdateDismissed(true)} className="text-xs text-muted">Dismiss</button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-[72px]">
        {tab === 'dashboard' && <DashboardPage siteId={siteId} sites={sites} trucks={trucks} onChangeSite={setSiteId} />}
        {tab === 'log' && <LogPage siteId={siteId} sites={sites} trucks={trucks} materials={materials} onRefresh={loadAll} showQr={showQr} setShowQr={setShowQr} onQrScan={handleQrScan} scannedTruckId={scannedTruckId} onScannedTruckUsed={() => setScannedTruckId(null)} />}
        {tab === 'trucks' && <TrucksPage trucks={trucks} onRefresh={loadTrucks} setShowQrModalFor={setShowQrModalFor} />}
        {tab === 'more' && <MorePage siteId={siteId} sites={sites} trucks={trucks} materials={materials} onRefreshSites={loadSites} onRefreshTrucks={loadTrucks} onRefreshMaterials={loadMaterials} onRefreshAll={loadAll} user={user} />}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
      <Toast toasts={toasts} />

      {/* QR Scanner */}
      <Suspense fallback={null}>
        {showQr && <QrScanner open={showQr} onClose={() => setShowQr(false)} onScan={handleQrScan} />}
      </Suspense>

      {/* Truck QR Modal */}
      <Suspense fallback={null}>
        {showQrModalFor && <TruckQrModal open={!!showQrModalFor} onClose={() => setShowQrModalFor(null)} truck={showQrModalFor} />}
      </Suspense>
    </div>
  )
}
