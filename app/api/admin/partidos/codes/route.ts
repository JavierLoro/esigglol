import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { GenerateCodesSchema } from '@/lib/schemas'
import { getMatches, saveMatches, getPhaseById } from '@/lib/data'
import { getTournamentConfig, generateCodes, getCodeDetails, TournamentApiError } from '@/lib/tournament'
import type { BOFormat } from '@/lib/types'

export async function POST(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }) }

  const parsed = GenerateCodesSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const config = getTournamentConfig()
  if (!config) return NextResponse.json({ error: 'Tournament no configurado. Registra primero desde el dashboard.' }, { status: 400 })

  const matches = getMatches()
  const match = matches.find(m => m.id === parsed.data.matchId)
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })

  const existingCodes = match.tournamentCodes ?? []
  let regenerated = false
  if (existingCodes.length) {
    // Riot does not expose an expiry timestamp. A code-details lookup is the
    // authoritative check: expired/unknown codes return 404.
    const checks = await Promise.allSettled(existingCodes.map(code => getCodeDetails(code)))
    const failed = checks.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    const nonExpiryFailure = failed.find(result => !(result.reason instanceof TournamentApiError) || result.reason.status !== 404)
    if (nonExpiryFailure) {
      const reason = nonExpiryFailure.reason instanceof Error ? nonExpiryFailure.reason.message : 'Error desconocido'
      return NextResponse.json({ error: reason }, { status: 502 })
    }
    regenerated = failed.length > 0
    if (!regenerated) {
      return NextResponse.json({ error: 'Este partido ya tiene tournament codes activos' }, { status: 409 })
    }
  }

  const phase = getPhaseById(match.phaseId)
  const roundStr = String(match.round)
  const bo: BOFormat = (phase?.config.roundBo?.[roundStr]) ?? phase?.config.bo ?? 1
  const codeCount = bo === 2 ? 3 : bo // BO2 needs up to 3 games, others match BO number

  try {
    const codes = await generateCodes(config.tournamentId, codeCount)
    match.tournamentCodes = codes
    match.tournamentCodesGeneratedAt = new Date().toISOString()
    saveMatches(matches)
    return NextResponse.json({ codes, regenerated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
