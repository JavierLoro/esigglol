import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getRefreshState, getRefreshTarget, runPlayerRefresh } from '@/lib/refresh'
import logger from '@/lib/logger'

const log = logger.child({ module: 'refresh-player' })

export async function POST(req: Request) {
  const denied = await requireAdminSession()
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const summonerName = typeof body === 'object' && body !== null && 'summonerName' in body
    && typeof body.summonerName === 'string'
    ? body.summonerName.trim()
    : ''

  if (!summonerName || summonerName.length > 100) {
    return NextResponse.json({ error: 'Se requiere un nombre de jugador válido' }, { status: 400 })
  }

  if (!getRefreshTarget(summonerName)) {
    return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 })
  }

  if (getRefreshState().running) {
    return NextResponse.json(
      { status: 'running', message: 'Ya hay una actualización en curso' },
      { status: 409 },
    )
  }

  after(async () => {
    try {
      await runPlayerRefresh(summonerName)
    } catch (err) {
      log.error({ summonerName, err }, 'Error refreshing player')
    }
  })

  return NextResponse.json({ status: 'started', summonerName })
}
