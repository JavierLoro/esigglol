import { readFileSync } from 'fs'
import { join } from 'path'
import { getTeams, getPlayerStatsCache, savePlayerStatsCache } from '@/lib/data'
import { getPlayerStats, getChampionMastery, getMatchIds, getMatchDetails, RiotApiKeyError } from '@/lib/riot'
import { savePlayerMastery, savePlayerMatches, getStoredMatchIds } from '@/lib/data-riot'
import { ensureProfileIcon } from '@/lib/ddragon'
import type { Player, Team, PlayerRow } from '@/lib/types'
import logger from '@/lib/logger'

const log = logger.child({ module: 'refresh' })

const AUTO_REFRESH_INTERVAL = 6 * 60 * 60 * 1000 // 6 horas para auto-refresh
const BATCH = 3
const BATCH_DELAY_MS = 30_000

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

let isRunning = false
let keyExpired = false

export function getRefreshState() {
  const cache = getPlayerStatsCache()
  return { lastUpdated: cache.lastUpdated, running: isRunning, keyExpired }
}

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
  const masteries = await getChampionMastery(puuid)
  savePlayerMastery(summonerName, masteries.map(m => ({
    championId: m.championId,
    championName: championMap.get(m.championId) ?? `Champion_${m.championId}`,
    masteryLevel: m.championLevel,
    masteryPoints: m.championPoints,
    lastPlayedAt: m.lastPlayTime,
    updatedAt: new Date().toISOString(),
  })))

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

export async function runRefresh(teamIds?: string[]) {
  isRunning = true
  keyExpired = false

  try {
    const normalizeName = (name: string) => name.trim().replace(/\s*#\s*/g, '#').toLowerCase()
    const allTeams = getTeams()
    const teams = teamIds ? allTeams.filter(t => teamIds.includes(t.id)) : allTeams
    const players = teams.flatMap((team: Team) =>
      team.players.map((p: Player) => ({ p, team }))
    )
    const championMap = buildChampionMap()
    const previousCache = getPlayerStatsCache()

    const rows: PlayerRow[] = []
    let aborted = false

    for (let i = 0; i < players.length; i += BATCH) {
      if (aborted) break

      const batch = players.slice(i, i + BATCH)
      await Promise.all(batch.map(async ({ p, team }: { p: Player; team: Team }) => {
        if (aborted) return

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

          if (stats.puuid) {
            try {
              await collectChampionData(p.summonerName, stats.puuid, championMap)
            } catch (err) {
              log.warn({ summonerName: p.summonerName, err }, 'Error collecting champion data')
            }
          }
        } catch (err) {
          if (err instanceof RiotApiKeyError) {
            log.error({ summonerName: p.summonerName }, 'Riot API key expired or invalid — aborting refresh')
            keyExpired = true
            aborted = true
            return
          }
          log.error({ summonerName: p.summonerName, err }, 'Error loading player stats from Riot API')
          const prev = previousCache.players.find(
            cp => normalizeName(cp.summonerName) === normalizeName(p.summonerName)
          )
          if (prev) {
            rows.push({ ...prev, apiError: true })
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
        }
      }))

      if (!aborted) {
        const dedupedMap = new Map<string, PlayerRow>()
        for (const r of rows) dedupedMap.set(normalizeName(r.summonerName), r)
        const uniqueRows = Array.from(dedupedMap.values())

        const refreshedNames = new Set(uniqueRows.map(r => normalizeName(r.summonerName)))
        const kept = previousCache.players.filter(
          p => !refreshedNames.has(normalizeName(p.summonerName))
        )
        savePlayerStatsCache({ lastUpdated: new Date().toISOString(), players: [...kept, ...uniqueRows] })
      }

      if (i + BATCH < players.length && !aborted) await delay(BATCH_DELAY_MS)
    }
  } finally {
    isRunning = false
  }
}

export async function triggerAutoRefresh() {
  if (isRunning) return
  if (keyExpired) return
  const cache = getPlayerStatsCache()
  if (cache.lastUpdated) {
    const age = Date.now() - new Date(cache.lastUpdated).getTime()
    if (age < AUTO_REFRESH_INTERVAL) return
  }
  log.info('Auto-refresh triggered (data older than 6h)')
  await runRefresh()
}
