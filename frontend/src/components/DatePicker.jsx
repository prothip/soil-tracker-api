import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toVal(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  // Months are 0-indexed in JS Date, but input is 1-indexed
  return { y, m: m - 1, d }
}

function toStr({ y, m, d }) {
  // m is already 0-indexed here
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function sameDay(a, b) {
  return a && b && a.y === b.y && a.m === b.m && a.d === b.d
}

export default function DatePicker({ value, onChange }) {
  const today = toVal(new Date().toISOString().split('T')[0])
  const current = toVal(value) || today

  const [open, setOpen] = useState(false)
  const [view, setView] = useState({ y: current.y, m: current.m })

  // Sync view when value changes externally
  useEffect(() => {
    const parsed = toVal(value)
    if (parsed) {
      setView({ y: parsed.y, m: parsed.m })
    }
  }, [value])

  const firstDay = new Date(view.y, view.m - 1, 1).getDay()
  const daysInMonth = new Date(view.y, view.m, 0).getDate()
  const prevDays = new Date(view.y, view.m - 1, 0).getDate()

  function prev() {
    const m = view.m === 0 ? 11 : view.m - 1
    const y = view.m === 0 ? view.y - 1 : view.y
    setView({ y, m })
  }
  function next() {
    const m = view.m === 11 ? 0 : view.m + 1
    const y = view.m === 11 ? view.y + 1 : view.y
    setView({ y, m })
  }

  function selectDay(d) {
    const date = { y: view.y, m: view.m, d }
    onChange(toStr(date))
    setOpen(false)
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) {
    const dd = prevDays - firstDay + i + 1
    const mm = view.m === 0 ? 11 : view.m - 1
    const yy = view.m === 0 ? view.y - 1 : view.y
    cells.push({ d: dd, m: mm, y: yy, other: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, m: view.m, y: view.y, other: false })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const mm = view.m === 11 ? 0 : view.m + 1
    const yy = view.m === 11 ? view.y + 1 : view.y
    cells.push({ d, m: mm, y: yy, other: true })
  }

  const selected = toVal(value)
  const label = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <span className={value ? 'text-text' : 'text-muted'}>{label || 'Pick a date'}</span>
        <span className="text-xs text-muted bg-bg px-2 py-0.5 rounded font-mono">{value || '—'}</span>
      </button>

      {open && (
        <div className="mt-1 bg-surface rounded-xl border border-border shadow-lg overflow-hidden z-[60] relative">
          {/* Month nav */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-bg">
            <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-border transition-colors">
              <ChevronLeft size={15} className="text-text" />
            </button>
            <span className="text-sm font-semibold text-text">
              {MONTHS[view.m]} {view.y}
            </span>
            <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-border transition-colors">
              <ChevronRight size={15} className="text-text" />
            </button>
          </div>
          {/* Day labels */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted py-1">{d}</div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-0.5">
            {cells.map((c, i) => {
              const isToday = today && c.y === today.y && c.m === today.m && c.d === today.d
              const isSelected = selected && c.y === selected.y && c.m === selected.m && c.d === selected.d
              const isCurrentMonth = !c.other
              return (
                <button
                  key={i}
                  onClick={() => selectDay(c.d)}
                  className={`
                    h-8 rounded-lg text-xs font-medium transition-all
                    ${isCurrentMonth ? 'text-text hover:bg-primary/10' : 'text-muted/40'}
                    ${isSelected ? 'bg-primary text-white' : ''}
                    ${isToday && !isSelected ? 'bg-accent/10 text-accent font-semibold' : ''}
                  `}
                >
                  {c.d}
                </button>
              )
            })}
          </div>
          {/* Footer — today shortcut */}
          <div className="px-2 pb-2">
            <button
              onClick={() => { onChange(new Date().toLocaleDateString('en-CA')); setOpen(false) }}
              className="w-full h-8 text-xs text-primary hover:bg-primary/5 rounded-lg font-medium transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
