import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { TournamentSetupSchema } from '@/lib/schemas'
import { registerProvider, createTournament, getTournamentConfig, saveTournamentConfig } from '@/lib/tournament'
import { RIOT_REGION } from '@/lib/env'

export async function GET() {
  const deny = await requireAdminSession()
  if (deny) return deny

  const config = getTournamentConfig()
  return NextResponse.json(config)
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
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host')
  if (!host) return NextResponse.json({ error: 'No se pudo determinar el host' }, { status: 400 })
  const callbackUrl = `${proto}://${host}/api/tournament/callback`

  try {
    const providerId = await registerProvider(callbackUrl, region.toUpperCase())
    const tournamentId = await createTournament(providerId, tournamentName)
    const config = { providerId, tournamentId }
    saveTournamentConfig(config)
    return NextResponse.json(config, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
