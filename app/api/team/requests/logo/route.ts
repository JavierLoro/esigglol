import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { requireTeamSession } from '@/lib/auth'
import { UPLOADS_DIR } from '@/lib/env'
import { createTeamChangeRequest } from '@/lib/team-portal-data'
import { resolveUploadPath, uploadUrl } from '@/lib/upload-files'

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function hasValidSignature(buffer: Buffer, type: string): boolean {
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (type === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  return false
}

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await requireTeamSession()
  if (session instanceof NextResponse) return session
  const form = await req.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
  const extension = TYPES[file.type]
  if (!extension) return NextResponse.json({ error: 'Usa PNG, JPG o WebP' }, { status: 422 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'El logo no puede superar 2 MB' }, { status: 422 })
  const buffer = Buffer.from(await file.arrayBuffer())
  if (!hasValidSignature(buffer, file.type)) return NextResponse.json({ error: 'El contenido no coincide con una imagen válida' }, { status: 422 })
  const filename = `pending-team-logo-${randomUUID()}.${extension}`
  const path = resolveUploadPath(filename)
  if (!path) return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 })
  await mkdir(UPLOADS_DIR, { recursive: true })
  await writeFile(path, buffer, { flag: 'wx' })
  try {
    return NextResponse.json(createTeamChangeRequest(session.teamId, 'team_logo', { logo: uploadUrl(filename) }), { status: 201 })
  } catch (error) {
    await unlink(path).catch(() => undefined)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 409 })
  }
}
