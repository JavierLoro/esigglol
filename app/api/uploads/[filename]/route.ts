import { NextResponse } from 'next/server'
import { UPLOADS_DIR } from '@/lib/env'
import { readFile } from 'fs/promises'
import path from 'path'

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

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Nombre de archivo no válido' }, { status: 400 })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME_TYPES[ext]
  if (!contentType) {
    return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
  }

  const filePath = path.join(UPLOADS_DIR, filename)

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
