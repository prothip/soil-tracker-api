import { useState, useEffect } from 'react'
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { Key, Shield, Loader2 } from 'lucide-react'

export default function LicenseGate({ onSuccess }) {
  const [licenseKey, setLicenseKey] = useState('')
  const [fingerprint, setFingerprint] = useState('')
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const fp = await FingerprintJS.load()
      const result = await fp.get()
      const fpValue = result.visitorId
      setFingerprint(fpValue)

      const saved = localStorage.getItem('stp_license')
      if (saved) {
        try {
          const res = await fetch(`/api/licenses/check?fingerprint=${encodeURIComponent(fpValue)}`)
          const data = await res.json()
          if (data.valid && data.registered) {
            onSuccess()
            return
          }
        } catch {}
      }
      setLoading(false)
    }
    init()
  }, [])

  async function handleActivate(e) {
    e.preventDefault()
    if (!licenseKey.trim()) return
    setActivating(true)
    setError('')
    try {
      const res = await fetch('/api/licenses/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim(), fingerprint })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('stp_license', licenseKey.trim())
        window.location.reload()
      } else {
        setError(data.error || 'Activation failed')
      }
    } catch (err) {
      setError('Connection error — try again')
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="text-primary" size={32} />
          </div>
          <h1 className="text-xl font-bold text-text">Soil Tracker Pro</h1>
          <p className="text-sm text-muted mt-1">Enter your license key to activate</p>
        </div>
        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">License Key</label>
            <div className="relative">
              <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="STPRO-XXXXXX-XXXX"
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-border bg-surface text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          {error && <p className="text-danger text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={activating || !licenseKey.trim()}
            className="w-full h-12 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {activating ? <Loader2 size={16} className="animate-spin" /> : null}
            {activating ? 'Activating...' : 'Activate License'}
          </button>
        </form>
        <p className="text-center text-xs text-muted mt-6">
          Contact your administrator for a license key
        </p>
      </div>
    </div>
  )
}
