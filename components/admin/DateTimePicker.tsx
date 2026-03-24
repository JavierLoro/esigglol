'use client'
import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, X } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  value?: string        // ISO date string o undefined
  onChange: (iso: string | undefined) => void
  className?: string
}

export default function DateTimePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const selected = value ? parseISO(value) : undefined
  const timeStr = value ? format(parseISO(value), 'HH:mm') : '00:00'

  function handleDaySelect(day: Date | undefined) {
    if (!day) { onChange(undefined); return }
    const [h, m] = timeStr.split(':').map(Number)
    day.setHours(h, m, 0, 0)
    onChange(day.toISOString())
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [h, m] = e.target.value.split(':').map(Number)
    const base = selected ? new Date(selected) : new Date()
    base.setHours(h, m, 0, 0)
    onChange(base.toISOString())
  }

  return (
    <div ref={ref} className={clsx('relative', className)}>
      {/* Trigger input */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white hover:border-white/20 transition-colors text-left"
        >
          <Calendar size={13} className="text-white/40 shrink-0" />
          {selected
            ? format(selected, "dd MMM yyyy, HH:mm", { locale: es })
            : <span className="text-white/30">Sin fecha</span>
          }
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="p-1.5 text-white/20 hover:text-white/60 transition-colors"
            aria-label="Quitar fecha"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Popover calendario */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 rounded-xl border border-white/10 bg-[#0d1321] shadow-2xl p-3 min-w-[280px]">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleDaySelect}
            locale={es}
            weekStartsOn={1}
            classNames={{
              root: 'text-white text-sm',
              months: 'flex gap-4',
              month: 'flex flex-col gap-2',
              month_caption: 'flex justify-center items-center h-7 relative',
              caption_label: 'text-sm font-semibold capitalize text-white/90',
              nav: 'flex items-center gap-1 absolute inset-x-0 top-0',
              button_previous: 'absolute left-0 p-1 text-white/40 hover:text-white transition-colors rounded',
              button_next: 'absolute right-0 p-1 text-white/40 hover:text-white transition-colors rounded',
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday: 'w-9 text-[11px] text-white/30 font-normal text-center pb-1',
              weeks: 'flex flex-col gap-0.5',
              week: 'flex',
              day: 'w-9 h-9 text-center text-sm p-0 relative',
              day_button: clsx(
                'w-9 h-9 rounded-lg text-sm transition-colors',
                'hover:bg-white/10 text-white/80',
                'focus:outline-none focus:ring-1 focus:ring-[#0097D7]',
              ),
              today: '[&>button]:font-bold [&>button]:text-[#0097D7]',
              selected: '[&>button]:bg-[#0097D7] [&>button]:text-white [&>button]:hover:bg-[#33b3e8]',
              outside: '[&>button]:text-white/20',
              disabled: '[&>button]:opacity-30 [&>button]:cursor-not-allowed',
              chevron: 'w-4 h-4',
            }}
          />

          {/* Selector de hora */}
          <div className="border-t border-white/10 mt-2 pt-2 flex items-center gap-2">
            <span className="text-xs text-white/40 shrink-0">Hora</span>
            <input
              type="time"
              value={timeStr}
              onChange={handleTimeChange}
              className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white focus:outline-none [color-scheme:dark]"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded-lg bg-[#0097D7] text-white text-xs font-bold hover:bg-[#33b3e8] transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
