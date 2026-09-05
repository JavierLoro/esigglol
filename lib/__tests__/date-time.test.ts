import { describe, expect, it } from 'vitest'
import {
  formatLocalDateTime,
  formatLocalTime,
  getLocalTimeZoneLabel,
  localDateTimeToIso,
} from '@/lib/date-time'

describe('date/time presentation', () => {
  it('formats the same instant in the requested browser time zone', () => {
    const iso = '2026-07-05T16:30:00.000Z'

    expect(formatLocalDateTime(iso, {}, 'Europe/Madrid')).toContain('18:30')
    expect(formatLocalDateTime(iso, {}, 'America/New_York')).toContain('12:30')
    expect(formatLocalTime(iso, 'Asia/Kolkata')).toBe('22:00')
  })

  it('makes the local zone and its seasonal offset explicit', () => {
    expect(getLocalTimeZoneLabel('2026-07-05T16:30:00.000Z', 'Europe/Madrid'))
      .toBe('Europe/Madrid (CEST)')
    expect(getLocalTimeZoneLabel('2026-01-05T16:30:00.000Z', 'Europe/Madrid'))
      .toBe('Europe/Madrid (CET)')
  })
})

describe('localDateTimeToIso', () => {
  it('uses the local offset in force on the selected date during DST', () => {
    const previousTz = process.env.TZ
    process.env.TZ = 'Europe/Madrid'

    try {
      // 29 March 2026 is the spring-forward day in Europe/Madrid. 03:30
      // is therefore stored with CEST (+02:00), not today's offset.
      const iso = localDateTimeToIso(new Date(2026, 2, 29), '03:30')
      expect(iso).toBe('2026-03-29T01:30:00.000Z')
    } finally {
      if (previousTz === undefined) delete process.env.TZ
      else process.env.TZ = previousTz
    }
  })
})
