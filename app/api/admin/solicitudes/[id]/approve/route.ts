import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { requireAdminSession } from '@/lib/auth'
import { getTeamById } from '@/lib/data'
import { approveTeamChangeRequest, getTeamChangeRequest } from '@/lib/team-portal-data'
import { getUploadFilename, resolveUploadPath } from '@/lib/upload-files'

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const deny = await requireAdminSession()
  if (deny) return deny
  const { id } = await context.params
  const request = getTeamChangeRequest(id)
  if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  const previousLogo = request.type === 'team_logo' ? getTeamById(request.teamId)?.logo : undefined
  try {
    const approved = approveTeamChangeRequest(id)
    if (!approved) return NextResponse.json({ error: 'La solicitud ya fue resuelta' }, { status: 409 })
    if (previousLogo) {
      const filename = getUploadFilename(previousLogo)
      const path = filename ? resolveUploadPath(filename) : null
      if (path) await unlink(path).catch(() => undefined)
    }
    return NextResponse.json(approved.request)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 409 })
  }
}
