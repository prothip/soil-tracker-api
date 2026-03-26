import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, AlertCircle } from 'lucide-react'

export default function QrScanner({ open, onClose, onScan }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const scannerRef = useRef(null)
  const containerId = 'qr-reader-container'
  const mountedRef = useRef(true)
  const stopTimerRef = useRef(null)

  useEffect(() => {
    if (!open) return

    setError('')
    setLoading(true)
    mountedRef.current = true

    let scanner = null

    function handleScan(decodedText) {
      if (!mountedRef.current) return
      // Force close after short delay regardless of stop() success
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      stopTimerRef.current = setTimeout(() => {
        if (onScan && decodedText) onScan(decodedText)
        if (onClose) onClose()
      }, 100)
      // Try to stop scanner but don't wait
      if (scanner) {
        try { scanner.stop().catch(() => {}) } catch (_) {}
      }
    }

    function startScanner(cameras) {
      if (!mountedRef.current) return
      if (!cameras || cameras.length === 0) {
        setError('No cameras found on this device.')
        setLoading(false)
        return
      }

      const backCamera = cameras.find(c =>
        /back|rear|environment|后置|后摄/i.test(c.label)
      )
      const preferredCamera = backCamera || cameras[0]

      scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner

      const config = {
        fps: 5,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0,
      }

      scanner.start(
        preferredCamera.id,
        config,
        handleScan,
        () => {} // ignore scan errors
      ).then(() => {
        if (mountedRef.current) setLoading(false)
      }).catch(err => {
        if (mountedRef.current) {
          setError('Camera permission denied or unavailable.')
          setLoading(false)
        }
        if (scanner) { try { scanner.stop().catch(() => {}) } catch (_) {} }
      })
    }

    // Poll for container
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      const el = document.getElementById(containerId)
      if (el) {
        clearInterval(poll)
        Html5Qrcode.getCameras().then(startScanner).catch(err => {
          if (mountedRef.current) {
            setError('Unable to access camera.')
            setLoading(false)
          }
        })
      } else if (attempts > 30) {
        clearInterval(poll)
        if (mountedRef.current) {
          setError('Camera view failed to initialize.')
          setLoading(false)
        }
      }
    }, 100)

    return () => {
      mountedRef.current = false
      clearInterval(poll)
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      if (scanner) {
        try { scanner.stop().catch(() => {}) } catch (_) {}
      }
      scannerRef.current = null
    }
  }, [open])

  function handleClose() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    if (scannerRef.current) {
      try { scannerRef.current.stop().catch(() => {}) } catch (_) {}
    }
    if (onClose) onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black/90"
      style={{ paddingTop: 'env(safe-area-inset-top, 16px)', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
    >
      <div className="w-full flex items-center justify-between p-4">
        <div className="text-white font-semibold text-base">Scan Truck QR Code</div>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center w-full max-w-sm">
        <div id={containerId} className="w-full max-w-sm" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent rounded-br-lg" />
          </div>
        </div>
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 p-4">
            <AlertCircle size={48} className="text-red-400 mb-3" />
            <p className="text-white text-sm font-medium mb-1">Camera Error</p>
            <p className="text-white/60 text-xs px-6 text-center">{error}</p>
            <button onClick={handleClose} className="mt-4 px-6 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors">Close</button>
          </div>
        )}
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-3" />
            <p className="text-white/60 text-sm">Starting camera...</p>
          </div>
        )}
      </div>

      <div className="w-full p-4 text-center">
        <p className="text-white/50 text-xs">Point camera at truck QR code</p>
        <p className="text-white/30 text-xs mt-1">QR contains plate number (e.g. กข-1234)</p>
      </div>
    </div>
  )
}
