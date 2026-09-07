/**
 * Date/time helpers shared by the public views and the admin editor.
 *
 * Scheduled dates are instants (ISO strings with a UTC offset). They are
 * displayed in the browser's local time zone and are created by setting local
 * calendar fields before converting them back to ISO UTC. Using Date's local
 * setters is important around DST transitions: the offset used is the one
 * that applies to the selected date, not today's offset.
 */

export interface LocalDateTimeFormatOptions {
  includeWeekday?: boolean
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime())
}

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'hora local'
  } catch {
    return 'hora local'
  }
}

function getTimeZoneName(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(date)
  return parts.find(part => part.type === 'timeZoneName')?.value ?? timeZone
}

/** Return a stable, explicit label such as "Europe/Madrid (CEST)". */
export function getLocalTimeZoneLabel(iso?: string, timeZone = getBrowserTimeZone()): string {
  const date = iso ? new Date(iso) : new Date()
  if (!isValidDate(date)) return timeZone
  return `${timeZone} (${getTimeZoneName(date, timeZone)})`
}

/** Format an instant using the browser (or supplied) time zone. */
export function formatLocalDateTime(
  iso: string,
  options: LocalDateTimeFormatOptions = {},
  timeZone = getBrowserTimeZone(),
): string {
  const date = new Date(iso)
  if (!isValidDate(date)) return ''

  return new Intl.DateTimeFormat('es-ES', {
    ...(options.includeWeekday ? { weekday: 'short' as const } : {}),
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date)
}

/** Read the HH:mm fields of an instant in a specific local time zone. */
export function formatLocalTime(iso: string, timeZone = getBrowserTimeZone()): string {
  const date = new Date(iso)
  if (!isValidDate(date)) return '00:00'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date)
}

/**
 * Convert local calendar time to an ISO UTC instant.
 *
 * `baseDate` must represent the selected local calendar day. Date#setHours
 * lets the runtime apply the correct offset for that day, including DST.
 */
export function localDateTimeToIso(baseDate: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date(baseDate.getTime())
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}
