import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { runRefresh, getRefreshState } from '@/lib/refresh'

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

  const body = await req.json().catch(() => ({})) as { teamIds?: string[] }
  const teamIds = Array.isArray(body.teamIds) ? body.teamIds : undefined

  after(async () => { await runRefresh(teamIds) })

  return NextResponse.json({ status: 'started' })
}
