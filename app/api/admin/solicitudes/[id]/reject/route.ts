import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { requireAdminSession } from '@/lib/auth'
import { ResolveTeamRequestSchema } from '@/lib/schemas'
import { getTeamChangeRequest, rejectTeamChangeRequest } from '@/lib/team-portal-data'
import { getUploadFilename, resolveUploadPath } from '@/lib/upload-files'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const deny = await requireAdminSession()
  if (deny) return deny
  let raw: unknown = {}
  try { raw = await req.json() } catch { /* empty reason is valid */ }
  const parsed = ResolveTeamRequestSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { id } = await context.params
  const current = getTeamChangeRequest(id)
  if (!current) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  const rejected = rejectTeamChangeRequest(id, parsed.data.reason)
  if (!rejected) return NextResponse.json({ error: 'La solicitud ya fue resuelta' }, { status: 409 })
  if (current.type === 'team_logo') {
    const logo = typeof current.payload.logo === 'string' ? current.payload.logo : ''
    const filename = getUploadFilename(logo)
    const path = filename ? resolveUploadPath(filename) : null
    if (path) await unlink(path).catch(() => undefined)
  }
  return NextResponse.json(rejected)
}
