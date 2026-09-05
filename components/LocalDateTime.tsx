'use client'

import { useSyncExternalStore } from 'react'
import clsx from 'clsx'
import {
  formatLocalDateTime,
  getBrowserTimeZone,
  getLocalTimeZoneLabel,
} from '@/lib/date-time'

const subscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

interface Props {
  iso: string
  includeWeekday?: boolean
  className?: string
  /** Keep the time zone visible so the displayed instant is unambiguous. */
  showTimeZone?: boolean
}

export default function LocalDateTime({
  iso,
  includeWeekday = false,
  className,
  showTimeZone = true,
}: Props) {
  // Browser time zone is intentionally resolved after hydration. A server
  // component can safely include this client component without rendering a
  // different date in the initial HTML.
  const ready = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

  if (!ready) {
    return (
      <span className={clsx('inline-flex flex-col', className)}>
        <time dateTime={iso} aria-label="Fecha y hora local">—</time>
      </span>
    )
  }

  const timeZone = getBrowserTimeZone()
  return (
    <span className={clsx('inline-flex flex-col', className)}>
      <time dateTime={iso}>
        {formatLocalDateTime(iso, { includeWeekday }, timeZone) || 'Fecha no válida'}
      </time>
      {showTimeZone && (
        <span className="text-[10px] font-normal opacity-60">
          hora local · {getLocalTimeZoneLabel(iso, timeZone)}
        </span>
      )}
    </span>
  )
}
