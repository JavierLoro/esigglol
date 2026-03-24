import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { parseScreenshot } from '@/lib/screenshot-parser'

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const gameData = await parseScreenshot(base64, file.type)
    return NextResponse.json(gameData)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[parse-screenshot]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
