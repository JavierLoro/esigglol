import { NextRequest, NextResponse } from 'next/server'
import { getMatches, saveMatches } from '@/lib/data'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  // Riot sends an array of callback objects with tournament code info
  // In stub mode this never fires, but the structure is ready for production
  const events = Array.isArray(body) ? body : [body]

  const matches = getMatches()
  let updated = false

  for (const event of events) {
    const e = event as { shortCode?: string; metaData?: string; gameId?: number; winningTeam?: string[] }
    if (!e.shortCode) continue

    const match = matches.find(m => m.tournamentCodes?.includes(e.shortCode!))
    if (!match) continue

    // Store the Riot match/game ID if available
    if (e.gameId) {
      const riotId = String(e.gameId)
      if (!match.riotMatchIds.includes(riotId)) {
        match.riotMatchIds.push(riotId)
        updated = true
      }
    }
  }

  if (updated) saveMatches(matches)

  return NextResponse.json({ ok: true })
}
