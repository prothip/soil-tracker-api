import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { X, Printer } from 'lucide-react'

export default function TruckQrModal({ truck, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [generating, setGenerating] = useState(true)

  useEffect(() => {
    if (!truck?.plate_number) return
    QRCode.toDataURL(truck.plate_number, {
      width: 240,
      margin: 2,
      color: { dark: '#111111', light: '#ffffff' },
    }).then(url => {
      setQrDataUrl(url)
      setGenerating(false)
    }).catch(() => {
      setGenerating(false)
    })
  }, [truck])

  function handlePrint() {
    const win = window.open('', '_blank', 'width=400,height=500')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print QR - ${truck.plate_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #fff;
      padding: 24px;
    }
    .label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      width: 100%;
      max-width: 280px;
    }
    .qr {
      width: 200px;
      height: 200px;
      display: block;
    }
    .plate {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #111;
      text-align: center;
    }
    .note {
      font-size: 11px;
      color: #999;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      .label { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="label">
    <img class="qr" src="${qrDataUrl}" alt="QR for ${truck.plate_number}" />
    <div class="plate">${truck.plate_number}</div>
    <div class="note">Soil Tracker Pro</div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-text">Truck QR Code</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          {generating ? (
            <div className="w-48 h-48 flex items-center justify-center">
              <div className="text-muted text-sm">Generating...</div>
            </div>
          ) : qrDataUrl ? (
            <>
              <img
                src={qrDataUrl}
                alt={`QR for ${truck.plate_number}`}
                className="w-48 h-48 rounded-xl border-4 border-white shadow-lg"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="text-center">
                <div className="text-xl font-bold text-text uppercase tracking-widest">{truck.plate_number}</div>
                {truck.driver_name && (
                  <div className="text-sm text-muted mt-1">{truck.driver_name}</div>
                )}
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={handlePrint}
                  className="flex-1 h-12 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Print Label
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-12 bg-border text-text font-semibold rounded-xl hover:bg-border/80 active:scale-[0.98] transition-all"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <div className="text-danger text-sm">Failed to generate QR code</div>
          )}
        </div>
      </div>
    </div>
  )
}
