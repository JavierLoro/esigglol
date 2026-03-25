import { NextResponse } from 'next/server'
import { after } from 'next/server'
import logger from '@/lib/logger'

const log = logger.child({ module: 'refresh-stats' })
import { readFileSync } from 'fs'
import { join } from 'path'
import { getTeams, getPlayerStatsCache, savePlayerStatsCache } from '@/lib/data'
import { getPlayerStats, getChampionMastery, getMatchIds, getMatchDetails } from '@/lib/riot'
import { savePlayerMastery, savePlayerMatches, getStoredMatchIds, getPlayerLastUpdated } from '@/lib/data-riot'
import { ensureProfileIcon } from '@/lib/ddragon'
import type { Player, Team, PlayerRow } from '@/lib/types'

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
    log.warn('No se pudo leer champion.json, mastery sin nombres')
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
      log.warn({ matchId, summonerName, err }, 'Error fetching match')
    }
  }

  log.info({ summonerName, mastery: masteries.length, matchesSaved: saved, matchesNew: newIds.length }, 'Player refreshed')
}

async function runRefresh(teamIds?: string[]) {
  const allTeams = getTeams()
  const teams = teamIds ? allTeams.filter(t => teamIds.includes(t.id)) : allTeams
  const players = teams.flatMap((team: Team) =>
    team.players.map((p: Player) => ({ p, team }))
  )
  const championMap = buildChampionMap()
  const previousCache = getPlayerStatsCache()

  const rows: PlayerRow[] = []

  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH)
    await Promise.all(batch.map(async ({ p, team }: { p: Player; team: Team }) => {
      // Skip si el jugador se actualizó hace menos de 2h
      const playerLastUpdated = getPlayerLastUpdated(p.summonerName)
      if (playerLastUpdated && (Date.now() - new Date(playerLastUpdated).getTime()) < PLAYER_COOLDOWN_MS) {
        log.info({ summonerName: p.summonerName, lastUpdated: playerLastUpdated }, 'Skip: recently updated')
        const prev = previousCache.players.find(cp => cp.summonerName === p.summonerName)
        if (prev) {
          rows.push(prev)
        } else {
          rows.push({
            summonerName: p.summonerName, puuid: '', profileIconId: 0,
            level: 0, tier: 'UNRANKED', rank: 'IV', lp: 0,
            wins: 0, losses: 0, winrate: 0,
            teamId: team.id, teamName: team.name, teamLogo: team.logo,
            primaryRole: p.primaryRole, secondaryRole: p.secondaryRole,
            apiError: true,
          })
        }
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
            log.warn({ summonerName: p.summonerName, err }, 'Error collecting champion data')
          }
        }
      } catch (err) {
        log.error({ summonerName: p.summonerName, err }, 'Error loading player stats from Riot API')
        rows.push({
          summonerName: p.summonerName,
          puuid: '',
          profileIconId: 0,
          level: 0,
          tier: 'UNRANKED',
          rank: 'IV',
          lp: 0,
          wins: 0,
          losses: 0,
          winrate: 0,
          teamId: team.id,
          teamName: team.name,
          teamLogo: team.logo,
          primaryRole: p.primaryRole,
          secondaryRole: p.secondaryRole,
          apiError: true,
        })
      }
    }))

    // Merge parcial: mantener jugadores no refrescados del cache anterior
    const refreshedNames = new Set(rows.map(r => r.summonerName))
    const kept = previousCache.players.filter(
      p => !refreshedNames.has(p.summonerName)
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
