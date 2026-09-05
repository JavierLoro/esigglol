import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { TournamentSetupSchema } from '@/lib/schemas'
import { registerProvider, createTournament, getTournamentConfig, saveTournamentConfig, deleteTournamentConfig } from '@/lib/tournament'
import { RIOT_REGION } from '@/lib/env'

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
  const region = RIOT_REGION

  // Derive callback URL from the request's own origin
  const callbackUrl = getCallbackUrl(req)
  if (!callbackUrl) return NextResponse.json({ error: 'No se pudo determinar el host' }, { status: 400 })

  try {
    const providerId = await registerProvider(callbackUrl, region.toUpperCase())
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
