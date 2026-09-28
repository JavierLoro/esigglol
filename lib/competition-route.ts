import { NextRequest, NextResponse } from 'next/server'
import { inTournament, LEGACY_TOURNAMENT_ID } from './competition-context'
import { getTournament } from './competitions'
import { getTeamSessionFromCookies, requireAdminSession } from './auth'
import db from './db'

type Mode = 'admin' | 'team' | 'public' | 'lol'
export function competitionRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>, mode: Mode = 'admin') {
  return async (...args: A): Promise<Response> => {
    const request = args[0] as NextRequest | undefined
    if (mode === 'admin' || mode === 'lol') {
      const denied = await requireAdminSession()
      if (denied) return denied
    }
    const selected = (request?.url ? new URL(request.url).searchParams.get('tournament') : undefined) ?? request?.headers?.get('x-tournament-id')
    if (request && (mode === 'admin' || mode === 'lol') && !selected) return NextResponse.json({ error: 'Selecciona un torneo concreto' }, { status: 400 })
    let id = selected ?? LEGACY_TOURNAMENT_ID
    if (mode === 'team') {
      const session = await getTeamSessionFromCookies()
      if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      const row = db.prepare('SELECT data FROM teams WHERE id = ?').get(session.teamId) as { data: string } | undefined
      if (!row) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
      id = JSON.parse(row.data).tournamentId
    }
    const tournament = getTournament(id)
    if (!tournament || (mode === 'public' && tournament.status !== 'published')) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
    if (mode === 'lol' && tournament.game !== 'lol') return NextResponse.json({ error: 'Disponible solo para LoL' }, { status: 422 })
    if (request && !['GET', 'HEAD'].includes(request.method) && tournament.status === 'archived') return NextResponse.json({ error: 'Torneo archivado: reábrelo para editar' }, { status: 409 })
    return inTournament(id, () => handler(...args))
  }
}
