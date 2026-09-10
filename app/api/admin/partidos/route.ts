import { NextRequest, NextResponse } from 'next/server'
import { getMatches, saveMatches, generateId, getPhaseById, savePhase, getTeams, getPhases } from '@/lib/data'
import { requireAdminSession } from '@/lib/auth'
import { recalculateBracket } from '@/lib/bracket'
import { MatchSchema, MatchUpdateSchema, DeleteIdsSchema } from '@/lib/schemas'
import type { Match } from '@/lib/types'
import { z } from 'zod'
import logger from '@/lib/logger'
import { validateMatch, issuesToMessage } from '@/lib/domain-validation'
import { validateMatchResult } from '@/lib/match-validation'
import { validateAndNormalizeMatch } from '@/lib/match-coherence'
import { derivePhaseStatus } from '@/lib/phase-status'

const log = logger.child({ module: 'partidos' })

export async function GET() {
  const deny = await requireAdminSession()
  if (deny) return deny
  return NextResponse.json(getMatches())
}

export async function POST(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = z.union([MatchSchema, z.array(MatchSchema)]).safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') }, { status: 422 })

  const matches = getMatches()
  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
  const newMatches: Match[] = []
  for (const item of items) {
    const candidate = { id: generateId('match'), ...item } satisfies Match
    const phase = getPhaseById(candidate.phaseId)
    if (!phase) return NextResponse.json({ error: 'Fase no encontrada' }, { status: 404 })
    const checked = validateAndNormalizeMatch(candidate, phase)
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 })
    const validationError = validateMatchResult(phase, checked.match, checked.match.result)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })
    const domainIssues = validateMatch(checked.match, getTeams(), getPhases())
    if (domainIssues.length) return NextResponse.json({ error: issuesToMessage(domainIssues) }, { status: 422 })
    newMatches.push(checked.match)
  }

  matches.push(...newMatches)
  try { saveMatches(matches) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json(newMatches, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = MatchUpdateSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') }, { status: 422 })

  const body = parsed.data as Match
  const checked = validateAndNormalizeMatch(body, getPhaseById(body.phaseId))
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 })
  const normalizedBody = checked.match
  let matches = getMatches()
  const idx = matches.findIndex(m => m.id === body.id)
  if (idx === -1) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const existingMatch = matches[idx]

  const phase = getPhaseById(normalizedBody.phaseId)
  if (!phase) return NextResponse.json({ error: 'Fase no encontrada' }, { status: 404 })
  const validationError = validateMatchResult(phase, normalizedBody, normalizedBody.result)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

  const allowedTbdFields = new Set<'team1Id' | 'team2Id'>()
  if (existingMatch.team1Id === 'TBD' && normalizedBody.team1Id === 'TBD') allowedTbdFields.add('team1Id')
  if (existingMatch.team2Id === 'TBD' && normalizedBody.team2Id === 'TBD') allowedTbdFields.add('team2Id')
  const domainIssues = validateMatch(normalizedBody, getTeams(), getPhases(), allowedTbdFields)
  if (domainIssues.length) return NextResponse.json({ error: issuesToMessage(domainIssues) }, { status: 422 })

  matches[idx] = normalizedBody

  matches = recalculateBracket(phase, matches)

  try { saveMatches(matches) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }

  // ── Actualizar automáticamente el ciclo de estado de la fase ────────────
  const status = derivePhaseStatus(phase, matches)
  if (phase.status !== status) {
    try { savePhase({ ...phase, status }) } catch (err) { log.error({ err }, 'DB write failed on phase status update') }
  }

  return NextResponse.json(normalizedBody)
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = DeleteIdsSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const toDelete = new Set(parsed.data.ids ?? (parsed.data.id ? [parsed.data.id] : []))
  if (toDelete.size === 0) {
    return NextResponse.json({ error: 'No se especificaron IDs' }, { status: 400 })
  }

  const previousMatches = getMatches()
  const affectedPhaseIds = new Set(previousMatches.filter(match => toDelete.has(match.id)).map(match => match.phaseId))
  let matches = previousMatches.filter(match => !toDelete.has(match.id))
  for (const phaseId of affectedPhaseIds) {
    const phase = getPhaseById(phaseId)
    if (phase) matches = recalculateBracket(phase, matches)
  }
  try { saveMatches(matches) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  for (const phaseId of affectedPhaseIds) {
    const phase = getPhaseById(phaseId)
    if (!phase) continue
    const status = derivePhaseStatus(phase, matches)
    if (phase.status !== status) {
      try { savePhase({ ...phase, status }) } catch (err) { log.error({ err }, 'DB write failed on phase status update') }
    }
  }
  return NextResponse.json({ ok: true, deleted: toDelete.size })
}
