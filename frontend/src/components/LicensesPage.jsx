import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Key, Copy, Check, RefreshCw, Shield, Trash2, Ban, CheckCircle } from 'lucide-react'

export default function LicensesPage({ showToast }) {
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.licenses.list()
      setLicenses(data)
    } catch (e) {
      showToast('Failed to load licenses', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const data = await api.licenses.generate()
      setNewKey(data.licenseKey)
      await load()
      showToast('License key generated')
    } catch (e) {
      showToast('Failed to generate key', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevoke(id) {
    try {
      await api.licenses.revoke(id)
      showToast('License revoked')
      await load()
    } catch (e) {
      showToast('Failed to revoke', 'error')
    }
  }

  async function handleActivate(id) {
    try {
      await api.licenses.activate(id)
      showToast('License activated')
      await load()
    } catch (e) {
      showToast('Failed to activate', 'error')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this license permanently?')) return
    try {
      await api.licenses.delete(id)
      showToast('License deleted')
      await load()
    } catch (e) {
      showToast('Failed to delete', 'error')
    }
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  function maskFingerprint(fp) {
    if (!fp) return 'Not registered'
    return fp.slice(0, 4) + '....' + fp.slice(-4)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">👑 License Management</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="h-9 px-4 bg-primary text-white text-sm font-semibold rounded-xl flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
          {generating ? 'Generating...' : 'Generate Key'}
        </button>
      </div>

      {newKey && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4">
          <p className="text-xs text-muted mb-1.5">New license key — copy and share with customer:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm font-bold text-success">{newKey}</code>
            <button onClick={() => copyKey(newKey)} className="p-2 hover:bg-success/20 rounded-lg transition-colors">
              {copied === newKey ? <CheckCircle size={16} className="text-success" /> : <Copy size={16} className="text-muted" />}
            </button>
          </div>
          <button onClick={() => setNewKey('')} className="mt-2 text-xs text-muted hover:text-text">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted text-sm">Loading...</div>
      ) : licenses.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm">No licenses yet</div>
      ) : (
        <div className="space-y-2">
          {licenses.map(l => (
            <div key={l.id} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="font-mono text-sm font-bold text-text truncate">{l.license_key}</code>
                    <button onClick={() => copyKey(l.license_key)} className="p-1 hover:bg-border rounded transition-colors flex-shrink-0">
                      {copied === l.license_key ? <Check size={12} className="text-success" /> : <Copy size={12} className="text-muted" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${l.status === 'active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {l.status}
                    </span>
                    <span>Fingerprint: {maskFingerprint(l.fingerprint)}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Created: {new Date(l.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {l.status === 'active' ? (
                    <button onClick={() => handleRevoke(l.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-warning hover:bg-warning/10 transition-colors" title="Revoke">
                      <Ban size={14} />
                    </button>
                  ) : (
                    <button onClick={() => handleActivate(l.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-success hover:bg-success/10 transition-colors" title="Activate">
                      <CheckCircle size={14} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(l.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
