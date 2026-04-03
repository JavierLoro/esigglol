import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
})

describe('refresh env config', () => {
  it('uses defaults when refresh env vars are not provided', async () => {
    delete process.env.REFRESH_AUTO_INTERVAL_MS
    delete process.env.REFRESH_BATCH_SIZE
    delete process.env.REFRESH_BATCH_DELAY_MS
    process.env.SESSION_SECRET = 'test-session-secret'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'

    const env = await import('@/lib/env')
    expect(env.REFRESH_AUTO_INTERVAL_MS).toBe(6 * 60 * 60 * 1000)
    expect(env.REFRESH_BATCH_SIZE).toBe(3)
    expect(env.REFRESH_BATCH_DELAY_MS).toBe(30_000)
  })

  it('uses valid values and falls back for invalid ones', async () => {
    process.env.REFRESH_AUTO_INTERVAL_MS = '120000'
    process.env.REFRESH_BATCH_SIZE = '0'
    process.env.REFRESH_BATCH_DELAY_MS = '-1'
    process.env.SESSION_SECRET = 'test-session-secret'
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$abcdefghijklmnopqrstuv1234567890abcdEFGHIJKLMN'

    const env = await import('@/lib/env')
    expect(env.REFRESH_AUTO_INTERVAL_MS).toBe(120_000)
    expect(env.REFRESH_BATCH_SIZE).toBe(3)
    expect(env.REFRESH_BATCH_DELAY_MS).toBe(30_000)
  })
})
