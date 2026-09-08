import { NextRequest, NextResponse } from 'next/server'
import { getMatches, saveMatches } from '@/lib/data'
import { publishRiotResult } from '@/lib/riot-events'

interface CallbackMetadata {
  matchId?: string
  callbackToken?: string
}

function parseMetadata(value: unknown): CallbackMetadata | null {
  if (typeof value !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed as CallbackMetadata : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  // Riot sends an array of callback objects with tournament code info
  // In stub mode this never fires, but the structure is ready for production
  const events = Array.isArray(body) ? body : [body]

  const matches = getMatches()
  const notifications: { matchId: string; gameId: string; shortCode: string }[] = []

  for (const event of events) {
    const e = event as { shortCode?: string; metaData?: string; gameId?: number }
    if (!e.shortCode) continue

    const match = matches.find(m => m.tournamentCodes?.includes(e.shortCode!))
    if (!match) continue

    const metadata = parseMetadata(e.metaData)
    if (!metadata || metadata.matchId !== match.id || metadata.callbackToken !== match.tournamentCallbackToken) continue

    // Store the Riot match/game ID if available
    if (e.gameId) {
      const riotId = String(e.gameId)
      if (!match.riotMatchIds.includes(riotId)) {
        match.riotMatchIds.push(riotId)
        notifications.push({ matchId: match.id, gameId: riotId, shortCode: e.shortCode })
      }
    }
  }

  if (notifications.length > 0) {
    saveMatches(matches)
    const receivedAt = new Date().toISOString()
    for (const notification of notifications) publishRiotResult({ ...notification, receivedAt })
  }

  return NextResponse.json({ ok: true })
}
