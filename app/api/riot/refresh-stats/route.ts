import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { runRefresh, getRefreshState, COOLDOWN_MS } from '@/lib/refresh'

// GET: devuelve el estado actual (para polling desde el cliente)
export async function GET() {
  return NextResponse.json(getRefreshState())
}

// POST: arranca la actualización en background y responde inmediatamente
export async function POST(req: Request) {
  const state = getRefreshState()

  if (state.running) {
    return NextResponse.json({ status: 'running', message: 'Ya hay una actualización en curso' })
  }

  if (state.lastUpdated) {
    const elapsed = Date.now() - new Date(state.lastUpdated).getTime()
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000 / 60)
      return NextResponse.json(
        { error: `Actualización reciente. Espera ${remaining} min.` },
        { status: 429 }
      )
    }
  }

  const body = await req.json().catch(() => ({})) as { teamIds?: string[] }
  const teamIds = Array.isArray(body.teamIds) ? body.teamIds : undefined

  after(async () => { await runRefresh(teamIds) })

  return NextResponse.json({ status: 'started' })
}
