import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getTeams, getPlayerStatsCache, savePlayerStatsCache } from '@/lib/data'
import { getPlayerStats, getChampionMastery, getMatchIds, getMatchDetails } from '@/lib/riot'
import { savePlayerMastery, savePlayerMatches, getStoredMatchIds, getPlayerLastUpdated } from '@/lib/data-riot'
import { ensureProfileIcon } from '@/lib/ddragon'
import type { Player, Team } from '@/lib/types'

const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutos entre actualizaciones
const PLAYER_COOLDOWN_MS = 2 * 60 * 60 * 1000 // 2 horas entre actualizaciones por jugador
const BATCH = 3
const BATCH_DELAY_MS = 30_000 // 30s entre lotes (más calls por jugador con mastery+matches)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// Flag en memoria para evitar arranques dobles
let isRunning = false

function buildChampionMap(): Map<number, string> {
  try {
    const path = join(process.cwd(), 'public', 'ddragon', 'champion.json')
    const json = JSON.parse(readFileSync(path, 'utf-8')) as { data: Record<string, { key: string }> }
    const map = new Map<number, string>()
    for (const [name, data] of Object.entries(json.data)) {
      map.set(parseInt(data.key), name)
    }
    return map
  } catch {
    console.warn('[refresh-stats] No se pudo leer champion.json, mastery sin nombres')
    return new Map()
  }
}

async function collectChampionData(summonerName: string, puuid: string, championMap: Map<number, string>) {
  // Champion mastery
  const masteries = await getChampionMastery(puuid)
  savePlayerMastery(summonerName, masteries.map(m => ({
    championId: m.championId,
    championName: championMap.get(m.championId) ?? `Champion_${m.championId}`,
    masteryLevel: m.championLevel,
    masteryPoints: m.championPoints,
    lastPlayedAt: m.lastPlayTime,
    updatedAt: new Date().toISOString(),
  })))

  // Match history (no time limit — we need at least 20 matches for fallback stats)
  const matchIds = await getMatchIds(puuid, 100)
  const stored = getStoredMatchIds(summonerName)
  const newIds = matchIds.filter(id => !stored.has(id))

  if (newIds.length === 0) return

  let saved = 0
  for (const matchId of newIds) {
    try {
      const match = await getMatchDetails(matchId) as {
        info: {
          gameCreation: number; queueId: number
          participants: Array<{
            puuid: string; championId: number; championName: string; teamPosition: string
            kills: number; deaths: number; assists: number; win: boolean
          }>
        }
      }
      const participant = match.info.participants.find(p => p.puuid === puuid)
      if (!participant) continue

      savePlayerMatches(summonerName, [{
        matchId,
        championId: participant.championId,
        championName: participant.championName,
        position: participant.teamPosition || 'UNKNOWN',
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        win: participant.win,
        playedAt: match.info.gameCreation,
        queueId: match.info.queueId,
      }])
      saved++
    } catch (err) {
      console.warn(`[refresh-stats] Error fetching match ${matchId} for ${summonerName}`, err)
    }
  }

  console.log(`[refresh-stats] ${summonerName}: mastery ${masteries.length}, matches nuevos ${saved}/${newIds.length}`)
}

async function runRefresh(teamIds?: string[]) {
  const allTeams = getTeams()
  const teams = teamIds ? allTeams.filter(t => teamIds.includes(t.id)) : allTeams
  const players = teams.flatMap((team: Team) =>
    team.players.map((p: Player) => ({ p, team }))
  )
  const championMap = buildChampionMap()
  const previousCache = getPlayerStatsCache()

  const rows: unknown[] = []

  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH)
    await Promise.all(batch.map(async ({ p, team }: { p: Player; team: Team }) => {
      // Skip si el jugador se actualizó hace menos de 2h
      const playerLastUpdated = getPlayerLastUpdated(p.summonerName)
      if (playerLastUpdated && (Date.now() - new Date(playerLastUpdated).getTime()) < PLAYER_COOLDOWN_MS) {
        console.log(`[refresh-stats] Skip ${p.summonerName} (actualizado ${playerLastUpdated})`)
        const prev = (previousCache.players as any[]).find((cp: any) => cp.summonerName === p.summonerName)
        if (prev) rows.push(prev)
        return
      }

      try {
        const stats = await getPlayerStats(p.summonerName)
        ensureProfileIcon(stats.profileIconId).catch(() => {})
        rows.push({
          ...stats,
          teamId: team.id,
          teamName: team.name,
          teamLogo: team.logo,
          primaryRole: p.primaryRole,
          secondaryRole: p.secondaryRole,
        })

        // Recoger datos de campeones (mastery + historial)
        if (stats.puuid) {
          try {
            await collectChampionData(p.summonerName, stats.puuid, championMap)
          } catch (err) {
            console.warn('[refresh-stats] Error en champion data para', p.summonerName, err)
          }
        }
      } catch (err) {
        console.error('[Riot API] Error al cargar', p.summonerName, err)
      }
    }))

    // Merge parcial: mantener jugadores no refrescados del cache anterior
    const refreshedNames = new Set(rows.map((r: any) => r.summonerName))
    const kept = (previousCache.players as any[]).filter(
      (p: any) => !refreshedNames.has(p.summonerName)
    )
    savePlayerStatsCache({ lastUpdated: new Date().toISOString(), players: [...kept, ...rows] })

    if (i + BATCH < players.length) await delay(BATCH_DELAY_MS)
  }
}

// GET: devuelve el estado actual (para polling desde el cliente)
export async function GET() {
  const cache = getPlayerStatsCache()
  return NextResponse.json({ lastUpdated: cache.lastUpdated, running: isRunning })
}

// POST: arranca la actualización en background y responde inmediatamente
export async function POST(req: Request) {
  if (isRunning) {
    return NextResponse.json({ status: 'running', message: 'Ya hay una actualización en curso' })
  }

  const cache = getPlayerStatsCache()
  if (cache.lastUpdated) {
    const elapsed = Date.now() - new Date(cache.lastUpdated).getTime()
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000 / 60)
      return NextResponse.json(
        { error: `Actualización reciente. Espera ${remaining} min.` },
        { status: 429 }
      )
    }
  }

  const body = await req.json().catch(() => ({})) as { teamIds?: string[] }
  const teamIds = Array.isArray(body.teamIds) ? body.teamIds : undefined

  isRunning = true
  after(async () => {
    try {
      await runRefresh(teamIds)
    } finally {
      isRunning = false
    }
  })

  return NextResponse.json({ status: 'started' })
}
