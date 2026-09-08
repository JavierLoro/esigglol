import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { TournamentSetupSchema } from '@/lib/schemas'
import { registerProvider, createTournament, getTournamentConfig, saveTournamentConfig, deleteTournamentConfig } from '@/lib/tournament'
import { RIOT_REGION } from '@/lib/env'
import { TOURNAMENT_API_MODE } from '@/lib/env'
import { getRiotApiKey } from '@/lib/data'

const TOURNAMENT_REGIONS: Record<string, string> = {
  br1: 'BR', eun1: 'EUNE', euw1: 'EUW', jp1: 'JP', kr: 'KR',
  la1: 'LAN', la2: 'LAS', na1: 'NA', oc1: 'OCE', pbe1: 'PBE',
  ph2: 'PH', ru: 'RU', sg2: 'SG', th2: 'TH', tr1: 'TR', tw2: 'TW', vn2: 'VN',
}

function getCallbackUrl(req: NextRequest): string | null {
  const host = req.headers.get('host')
  if (!host) return null

  const forwardedProto = req.headers.get('x-forwarded-proto')
  const proto = forwardedProto?.split(',')[0]?.trim() || 'https'
  return `${proto}://${host}/api/tournament/callback`
}

function getTournamentStatus(req: NextRequest) {
  const config = getTournamentConfig()
  return {
    ...(config ?? {}),
    configured: config !== null,
    callbackUrl: getCallbackUrl(req),
    mode: TOURNAMENT_API_MODE,
    region: RIOT_REGION,
    hasApiKey: getRiotApiKey().length > 0,
  }
}

export async function GET(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  return NextResponse.json(getTournamentStatus(req))
}

export async function POST(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }) }

  const parsed = TournamentSetupSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { tournamentName } = parsed.data
  const region = TOURNAMENT_REGIONS[RIOT_REGION.toLowerCase()]
  if (!region) return NextResponse.json({ error: `RIOT_REGION no compatible con Tournament API: ${RIOT_REGION}` }, { status: 400 })

  // Derive callback URL from the request's own origin
  const callbackUrl = getCallbackUrl(req)
  if (!callbackUrl) return NextResponse.json({ error: 'No se pudo determinar el host' }, { status: 400 })

  try {
    const providerId = await registerProvider(callbackUrl, region)
    const tournamentId = await createTournament(providerId, tournamentName)
    const config = { providerId, tournamentId }
    saveTournamentConfig(config)
    return NextResponse.json({ ...config, configured: true, callbackUrl }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function DELETE() {
  const deny = await requireAdminSession()
  if (deny) return deny

  try {
    deleteTournamentConfig()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No se pudo resetear la configuración del torneo' }, { status: 500 })
  }
}
