import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getTwitchStatus: vi.fn() }))
vi.mock('@/lib/twitch', () => ({ getTwitchStatus: mocks.getTwitchStatus }))

import { GET } from '@/app/api/twitch/status/route'

describe('GET /api/twitch/status', () => {
  it('returns the checked status without allowing an intermediary stale response', async () => {
    mocks.getTwitchStatus.mockResolvedValue({ status: 'unknown', checkedAt: '2026-09-09T00:00:00.000Z' })

    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      status: 'unknown',
      checkedAt: '2026-09-09T00:00:00.000Z',
    })
  })
})
