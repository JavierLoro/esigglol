import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { checkValorantAccess, competitiveProfile, ValorantClient } from '@/lib/valorant'

/** Private development preview; no writes and no production personal-data route. */
export async function GET(req: NextRequest) {
  const denied = await requireAdminSession(); if (denied) return denied
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Prototipo disponible solo en desarrollo' }, { status: 403 })
  const search = req.nextUrl.searchParams
  if (search.get('mode') === 'fixture') {
    const { valorantPreviewFixture } = await import('@/lib/valorant-fixtures')
    return NextResponse.json(valorantPreviewFixture, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  const client = new ValorantClient()
  if (search.get('mode') === 'check') return NextResponse.json(await checkValorantAccess({ riotId: search.get('riotId') ?? undefined, puuid: search.get('puuid') ?? undefined, matchId: search.get('matchId') ?? undefined, actId: search.get('actId') ?? undefined }, client), { headers: { 'Cache-Control': 'no-store' } })
  const riotId = search.get('riotId') ?? ''
  const split = riotId.lastIndexOf('#')
  if (split < 1) return NextResponse.json({ error: 'Riot ID inválido' }, { status: 422 })
  const identity = await client.account(riotId.slice(0, split), riotId.slice(split + 1))
  const content = await client.content()
  const actId = search.get('actId') ?? content.data?.acts.find(a => a.isActive && a.type === 'act')?.id
  const ladder = actId ? await client.leaderboard(actId) : undefined
  return NextResponse.json({ identity, content, profile: identity.data && actId && ladder ? competitiveProfile('preview', identity.data.puuid, actId, ladder) : { availability: 'unavailable' } }, { headers: { 'Cache-Control': 'no-store' } })
}
