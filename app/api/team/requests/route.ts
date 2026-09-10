import { NextResponse } from 'next/server'
import { requireTeamSession } from '@/lib/auth'
import { NewPlayerRequestSchema, SummonerNameRequestSchema } from '@/lib/schemas'
import { createTeamChangeRequest, getTeamChangeRequests } from '@/lib/team-portal-data'
import { generateId, getTeamById } from '@/lib/data'

export async function GET() {
  const session = await requireTeamSession()
  return session instanceof NextResponse ? session : NextResponse.json(getTeamChangeRequests(session.teamId))
}

export async function POST(req: Request) {
  const session = await requireTeamSession()
  if (session instanceof NextResponse) return session
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!raw || typeof raw !== 'object' || !('type' in raw)) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 422 })
  try {
    if (raw.type === 'summoner_name') {
      const parsed = SummonerNameRequestSchema.safeParse(raw)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
      const team = getTeamById(session.teamId)
      if (!team?.players.some(player => player.id === parsed.data.playerId)) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 })
      return NextResponse.json(createTeamChangeRequest(session.teamId, 'summoner_name', { summonerName: parsed.data.summonerName }, parsed.data.playerId), { status: 201 })
    }
    if (raw.type === 'new_player') {
      const parsed = NewPlayerRequestSchema.safeParse(raw)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
      return NextResponse.json(createTeamChangeRequest(session.teamId, 'new_player', { id: generateId('player'), ...parsed.data }), { status: 201 })
    }
    return NextResponse.json({ error: 'Tipo de solicitud inválido' }, { status: 422 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 409 })
  }
}
