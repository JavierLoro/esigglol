import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from '@/lib/file-store'
import { z } from 'zod'
import { requireAdminSession } from '@/lib/auth'
import { getSiteBranding, saveSiteBranding } from '@/lib/site-branding'
import { UPLOADS_DIR } from '@/lib/env'
import { resolveUploadPath, uploadUrl } from '@/lib/upload-files'
import { StorageQuotaError } from '@/lib/storage-quota'

export const runtime = 'nodejs'
export async function GET() {
  const denied = await requireAdminSession(); if (denied) return denied
  return Response.json(getSiteBranding(), { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: Request) {
  const denied = await requireAdminSession(); if (denied) return denied
  let path: string | null = null
  try {
    const form = await req.formData()
    const parsed = z.object({ title: z.string().trim().min(1).max(150), subtitle: z.string().trim().max(150), channel: z.string().trim().max(25).regex(/^[A-Za-z0-9_]*$/).optional() }).safeParse({ title: form.get('title'), subtitle: form.get('subtitle'), channel: form.get('channel') ?? undefined })
    if (!parsed.success) return Response.json({ error: 'El título es obligatorio. Máximo 150 caracteres por campo.' }, { status: 422 })
    const file = form.get('logo')
    let logo = getSiteBranding().logo
    if (file instanceof File && file.size) {
      if (file.size > 2 * 1024 * 1024) return Response.json({ error: 'El logo no puede superar 2 MB.' }, { status: 422 })
      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
        : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'jpg'
        : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null
      if (!ext) return Response.json({ error: 'Usa una imagen PNG, JPG o WebP.' }, { status: 422 })
      const filename = `banner-${randomUUID()}.${ext}`
      path = resolveUploadPath(filename)
      if (!path) throw new Error('Invalid path')
      await mkdir(UPLOADS_DIR, { recursive: true })
      await writeFile(path, buffer, { flag: 'wx' })
      logo = uploadUrl(filename)
    }
    const value = { ...getSiteBranding(), ...parsed.data, logo }
    saveSiteBranding(value)
    return Response.json(value)
  } catch (error) {
    if (error instanceof StorageQuotaError) return Response.json({ error: error.message }, { status: 429 })
    if (path) await unlink(path).catch(() => {})
    return Response.json({ error: 'No se pudo guardar el banner.' }, { status: 500 })
  }
}
