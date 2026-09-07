import { NextRequest, NextResponse } from 'next/server'
import { getTeams, saveTeams, generateId, getTeamReferences } from '@/lib/data'
import { requireAdminSession } from '@/lib/auth'
import { TeamSchema, TeamUpdateSchema, DeleteIdSchema } from '@/lib/schemas'
import type { Team } from '@/lib/types'
import logger from '@/lib/logger'
import { validateTeams, issuesToMessage } from '@/lib/domain-validation'

const log = logger.child({ module: 'equipos' })

export async function GET() {
  const deny = await requireAdminSession()
  if (deny) return deny
  return NextResponse.json(getTeams(), {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function POST(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = TeamSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const teams = getTeams()
  const team: Team = { id: generateId('team'), ...parsed.data }
  const domainIssues = validateTeams([...teams, team])
  if (domainIssues.length) return NextResponse.json({ error: issuesToMessage(domainIssues) }, { status: 422 })
  teams.push(team)
  try { saveTeams(teams) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json(team, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = TeamUpdateSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const teams = getTeams()
  const idx = teams.findIndex(t => t.id === parsed.data.id)
  if (idx === -1) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  teams[idx] = parsed.data as Team
  const domainIssues = validateTeams(teams)
  if (domainIssues.length) return NextResponse.json({ error: issuesToMessage(domainIssues) }, { status: 422 })
  try { saveTeams(teams) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json(parsed.data)
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = DeleteIdSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const teams = getTeams()
  if (!teams.some(team => team.id === parsed.data.id)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const references = getTeamReferences(parsed.data.id)
  if (references.phaseIds.length > 0 || references.matchIds.length > 0) {
    return NextResponse.json({
      error: 'No se puede eliminar un equipo que está referenciado por fases o partidos',
      references,
    }, { status: 409 })
  }

  const remainingTeams = teams.filter(t => t.id !== parsed.data.id)
  try { saveTeams(remainingTeams) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
