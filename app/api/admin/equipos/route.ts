import { NextRequest, NextResponse } from 'next/server'
import { deleteTeam, generateId, getTeamReferences, getTeams, StaleWriteError, updateTeam } from '@/lib/data'
import { createTeamWithAccess, ensureExistingTeamsHaveAccess } from '@/lib/team-portal-data'
import { encryptTeamPassword, generateTeamPassword } from '@/lib/team-credentials'
import bcrypt from 'bcryptjs'
import { requireAdminSession } from '@/lib/auth'
import { TeamSchema, TeamUpdateSchema, DeleteIdSchema } from '@/lib/schemas'
import type { Team } from '@/lib/types'
import logger from '@/lib/logger'
import { validateTeams, issuesToMessage } from '@/lib/domain-validation'

const log = logger.child({ module: 'equipos' })

export async function GET() {
  const deny = await requireAdminSession()
  if (deny) return deny
  await ensureExistingTeamsHaveAccess()
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
  try {
    const password = generateTeamPassword()
    const passwordHash = await bcrypt.hash(password, 12)
    return NextResponse.json(createTeamWithAccess(team, passwordHash, encryptTeamPassword(password)), { status: 201 })
  } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
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
  try { return NextResponse.json(updateTeam(parsed.data as Team)) } catch (err) {
    if (err instanceof StaleWriteError) return NextResponse.json({ error: 'El equipo cambió en otra sesión. Recarga antes de guardar.' }, { status: 409 })
    log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
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

  try {
    if (!deleteTeam(parsed.data.id, parsed.data.version)) return NextResponse.json({ error: 'El equipo cambió en otra sesión. Recarga antes de eliminar.' }, { status: 409 })
  } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
