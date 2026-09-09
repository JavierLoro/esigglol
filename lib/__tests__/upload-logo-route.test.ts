import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getTeamById: vi.fn(),
  updateTeamLogo: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  randomUUID: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireAdminSession: mocks.requireAdminSession }))
vi.mock('@/lib/data', () => ({
  getTeamById: mocks.getTeamById,
  updateTeamLogo: mocks.updateTeamLogo,
}))
vi.mock('@/lib/env', () => ({ UPLOADS_DIR: 'C:/test-uploads' }))
vi.mock('fs/promises', () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
  unlink: mocks.unlink,
}))
vi.mock('crypto', () => ({ randomUUID: mocks.randomUUID }))

function uploadRequest(teamId: string, file = new File(['logo-bytes'], 'logo.png', { type: 'image/png' })) {
  const formData = new FormData()
  formData.set('teamId', teamId)
  formData.set('file', file)
  return new Request('http://localhost/api/admin/equipos/upload-logo', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/admin/equipos/upload-logo', () => {
  let POST: typeof import('@/app/api/admin/equipos/upload-logo/route').POST

  beforeAll(async () => {
    ;({ POST } = await import('@/app/api/admin/equipos/upload-logo/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminSession.mockResolvedValue(null)
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.unlink.mockResolvedValue(undefined)
    mocks.randomUUID.mockReturnValue('fixed-logo-id')
  })

  it('valida el equipo, persiste la asociación y elimina el logo anterior', async () => {
    const team: Team = { id: 'team-1', name: 'Alpha', logo: '/api/uploads/old-logo.png', players: [] }
    mocks.getTeamById.mockReturnValue(team)
    mocks.updateTeamLogo.mockImplementation((_teamId: string, logo: string) => ({ ...team, logo }))

    const response = await POST(uploadRequest(team.id))

    expect(response.status).toBe(200)
    const body = await response.json() as { path: string }
    expect(body.path).toBe('/api/uploads/logo-fixed-logo-id.png')
    expect(mocks.getTeamById).toHaveBeenCalledWith(team.id)
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('logo-fixed-logo-id.png'),
      expect.any(Buffer),
      { flag: 'wx' },
    )
    expect(mocks.updateTeamLogo).toHaveBeenCalledWith(team.id, body.path)
    expect(mocks.unlink).toHaveBeenCalledWith(expect.stringContaining('old-logo.png'))
  })

  it('no escribe ningún archivo para un equipo inexistente', async () => {
    mocks.getTeamById.mockReturnValue(undefined)

    const response = await POST(uploadRequest('missing-team'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Equipo no encontrado' })
    expect(mocks.mkdir).not.toHaveBeenCalled()
    expect(mocks.writeFile).not.toHaveBeenCalled()
    expect(mocks.updateTeamLogo).not.toHaveBeenCalled()
  })

  it('limpia el archivo nuevo cuando falla la persistencia de la asociación', async () => {
    const team: Team = { id: 'team-1', name: 'Alpha', logo: '/api/uploads/old-logo.png', players: [] }
    mocks.getTeamById.mockReturnValue(team)
    mocks.updateTeamLogo.mockImplementation(() => {
      throw new Error('database unavailable')
    })

    const response = await POST(uploadRequest(team.id))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Error interno' })
    expect(mocks.unlink).toHaveBeenCalledWith(expect.stringContaining('logo-fixed-logo-id.png'))
    expect(mocks.unlink).not.toHaveBeenCalledWith(expect.stringContaining('old-logo.png'))
  })
})
