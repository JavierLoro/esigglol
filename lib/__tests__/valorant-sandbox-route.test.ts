import { afterEach, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), content: vi.fn(), leaderboard: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.auth }))
vi.mock('@/lib/valorant', () => ({ ValorantClient: class { content = mocks.content; leaderboard = mocks.leaderboard } }))
import { POST } from '../../app/api/admin/pruebas/route'
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })
const request = (origin = 'http://localhost:3200') => new NextRequest('http://localhost:3200/api/admin/pruebas', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'RGAPI-test-credential-never-real' }) })

it('is unavailable outside the isolated development sandbox', async () => {
  vi.stubEnv('VALORANT_SANDBOX', '')
  expect((await POST(request())).status).toBe(404)
  vi.stubEnv('VALORANT_SANDBOX', '1'); vi.stubEnv('NODE_ENV', 'production')
  expect((await POST(request())).status).toBe(404)
  expect(mocks.content).not.toHaveBeenCalled()
})
it('requires admin and same origin before contacting Riot', async () => {
  vi.stubEnv('VALORANT_SANDBOX', '1')
  mocks.auth.mockResolvedValueOnce(new NextResponse(null, { status: 401 })).mockResolvedValueOnce(null)
  expect((await POST(request())).status).toBe(401)
  expect((await POST(request('https://elsewhere.example'))).status).toBe(403)
  expect(mocks.content).not.toHaveBeenCalled()
})
it('accepts the real loopback Host when Next normalizes the request URL', async () => {
  vi.stubEnv('VALORANT_SANDBOX', '1')
  mocks.auth.mockResolvedValue(null)
  const req = new NextRequest('http://localhost:3200/api/admin/pruebas', { method: 'POST', headers: { host: '127.0.0.1:3200', origin: 'http://127.0.0.1:3200', 'Content-Type': 'application/json' }, body: JSON.stringify({ key: '' }) })
  expect((await POST(req)).status).toBe(422)
})
it('accepts an accessible ladder without returning the key', async () => {
  vi.stubEnv('VALORANT_SANDBOX', '1'); vi.stubEnv('VALORANT_API_KEY', '')
  mocks.auth.mockResolvedValue(null)
  mocks.content.mockResolvedValue({ data: { acts: [{ id: 'act', name: 'Act', type: 'act', isActive: true }] } })
  mocks.leaderboard.mockResolvedValue({ availability: 'available' })
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ready: true, act: 'Act' })
  expect(process.env.VALORANT_API_KEY).toBe('RGAPI-test-credential-never-real')
})
it('does not replace a working key when Riot denies the new one', async () => {
  vi.stubEnv('VALORANT_SANDBOX', '1'); vi.stubEnv('VALORANT_API_KEY', 'previous')
  mocks.auth.mockResolvedValue(null)
  mocks.content.mockResolvedValue({ data: { acts: [{ id: 'act', name: 'Act', type: 'act', isActive: true }] } })
  mocks.leaderboard.mockResolvedValue({ availability: 'forbidden', httpStatus: 403 })
  expect((await POST(request())).status).toBe(422)
  expect(process.env.VALORANT_API_KEY).toBe('previous')
})
