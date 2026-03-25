import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getRiotApiKey, saveRiotApiKey } from '@/lib/data'

function maskKey(key: string): string {
  if (!key || key.length < 12) return key ? '****' : ''
  return key.slice(0, 5) + '****-****-****-' + key.slice(-12)
}

export async function GET() {
  const denied = await requireAdminSession()
  if (denied) return denied

  const key = getRiotApiKey()
  return NextResponse.json({ riotApiKey: maskKey(key), hasKey: key.length > 0 })
}

export async function PUT(req: Request) {
  const denied = await requireAdminSession()
  if (denied) return denied

  let body: { riotApiKey?: string }
  try {
    body = await req.json() as { riotApiKey?: string }
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const key = body.riotApiKey?.trim()
  if (!key || !key.startsWith('RGAPI-')) {
    return NextResponse.json(
      { error: 'La API key debe tener formato RGAPI-...' },
      { status: 422 },
    )
  }

  saveRiotApiKey(key)
  return NextResponse.json({ riotApiKey: maskKey(key), hasKey: true })
}
