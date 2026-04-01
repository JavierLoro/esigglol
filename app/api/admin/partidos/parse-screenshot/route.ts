import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { parseScreenshot } from '@/lib/screenshot-parser'
import logger from '@/lib/logger'

const log = logger.child({ module: 'parse-screenshot' })

export async function POST(req: Request) {
  const denied = await requireAdminSession()
  if (denied) return denied

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de imagen no soportado' }, { status: 400 })
    }

    const customPrompt = formData.get('prompt') as string | null

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const gameData = await parseScreenshot(base64, file.type, customPrompt ?? undefined)
    return NextResponse.json(gameData)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    log.error({ err: message }, 'Error parsing screenshot')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
