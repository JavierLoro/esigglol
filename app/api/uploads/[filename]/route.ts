import { NextResponse } from 'next/server'
import { getUploadFilename, resolveUploadPath } from '@/lib/upload-files'
import { readFile } from 'fs/promises'

export const runtime = 'nodejs'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params

  const safeFilename = getUploadFilename(`/api/uploads/${filename}`)
  if (!safeFilename) {
    return NextResponse.json({ error: 'Nombre de archivo no válido' }, { status: 400 })
  }

  const ext = safeFilename.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME_TYPES[ext]
  if (!contentType) {
    return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
  }

  const filePath = resolveUploadPath(safeFilename)
  if (!filePath) {
    return NextResponse.json({ error: 'Nombre de archivo no válido' }, { status: 400 })
  }

  try {
    const buffer = await readFile(filePath)
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }
}
