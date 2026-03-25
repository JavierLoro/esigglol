import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { UPLOADS_DIR } from '@/lib/env'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import logger from '@/lib/logger'

const log = logger.child({ module: 'upload-logo' })

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(req: Request) {
  const denied = await requireAdminSession()
  if (denied) return denied

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const teamId = formData.get('teamId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
    }

    if (!teamId) {
      return NextResponse.json({ error: 'Se requiere teamId' }, { status: 400 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Tipo de imagen no soportado. Usa PNG, JPG, WebP o SVG.' },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'La imagen no puede superar 2 MB' },
        { status: 400 },
      )
    }

    await mkdir(UPLOADS_DIR, { recursive: true })

    const filename = `${teamId}-${Date.now()}.${ext}`
    const filePath = path.join(UPLOADS_DIR, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    log.info({ teamId, filename }, 'Logo uploaded')

    return NextResponse.json({ path: `/api/uploads/${filename}` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    log.error({ err: message }, 'Error uploading logo')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
