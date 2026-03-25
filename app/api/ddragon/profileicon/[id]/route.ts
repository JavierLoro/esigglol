import { NextResponse } from 'next/server'
import { PROFILE_ICONS_DIR } from '@/lib/env'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID no válido' }, { status: 400 })
  }

  const filePath = path.join(PROFILE_ICONS_DIR, `${id}.png`)

  try {
    const buffer = await readFile(filePath)
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Icono no encontrado' }, { status: 404 })
  }
}
