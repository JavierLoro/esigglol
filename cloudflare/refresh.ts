import { currentTournamentId, inTournament } from '../lib/competition-context'
import { getTeams, getPlayerStatsCache, savePlayerStatsCache } from '../lib/data'
import { savePlayerMastery, savePlayerMatches, getStoredMatchIds } from '../lib/data-riot'
import { getRefreshTarget, loadPlayerRow, failedPlayerRow } from '../lib/refresh'
import assets from './assets'
import { getChampionMastery, getMatchIds, getMatchDetails, RiotApiKeyError, RiotRetryDeferred } from '../lib/riot'
import { REFRESH_AUTO_INTERVAL_MS } from '../lib/env'
import { getRuntime } from './context'
import { scheduleWork } from './schedule'

export { getRefreshTarget }
interface Target { playerId: string; summonerName: string }
function buildChampionMap(): Map<number, string> {
  return new Map(Object.entries(assets.champions.data ?? {}).map(([name, champion]) => [Number(champion.key), name]))
}
interface Job { tournament_id: string; targets: string; cursor: number; stage: string; match_ids: string; match_cursor: number; puuid: string; running: number; key_expired: number; attempts: number; due: number }

export const JOB_SCHEMA = `CREATE TABLE IF NOT EXISTS cloudflare_refresh_jobs (
  tournament_id TEXT PRIMARY KEY, targets TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'rank', match_ids TEXT NOT NULL DEFAULT '[]', match_cursor INTEGER NOT NULL DEFAULT 0,
  puuid TEXT NOT NULL DEFAULT '', running INTEGER NOT NULL DEFAULT 1, key_expired INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0, due INTEGER NOT NULL DEFAULT 0)`

function job(): Job | undefined { return getRuntime().database.prepare('SELECT * FROM cloudflare_refresh_jobs WHERE tournament_id=?').get(currentTournamentId()) as Job | undefined }
export function getRefreshState() {
  const current = job()
  return { lastUpdated: getPlayerStatsCache().lastUpdated, running: Boolean(current?.running), keyExpired: Boolean(current?.key_expired) }
}

export async function enqueueRefresh(teamIds?: string[], summonerName?: string): Promise<void> {
  const { database } = getRuntime()
  const targets: Target[] = getTeams().filter(team => !teamIds || teamIds.includes(team.id))
    .flatMap(team => team.players).filter(player => !summonerName || getRefreshTarget(summonerName)?.player.id === player.id)
    .map(player => ({ playerId: player.id, summonerName: player.summonerName }))
  database.prepare(`INSERT INTO cloudflare_refresh_jobs (tournament_id, targets, due) VALUES (?, ?, ?)
    ON CONFLICT(tournament_id) DO UPDATE SET targets=excluded.targets,cursor=0,stage='rank',match_ids='[]',match_cursor=0,
    puuid='',running=1,key_expired=0,attempts=0,due=excluded.due WHERE running=0`).run(currentTournamentId(), JSON.stringify(targets), Date.now())
  // Commit the job and its alarm before acknowledging the HTTP request.
  await scheduleWork()
}

export async function runRefresh(teamIds?: string[]) { await enqueueRefresh(teamIds) }
export async function runPlayerRefresh(summonerName: string): Promise<void> {
  await enqueueRefresh(undefined, summonerName)
}
export async function triggerAutoRefresh() {
  const state = getRefreshState()
  if (state.running || state.keyExpired) return
  if (state.lastUpdated && Date.now() - Date.parse(state.lastUpdated) < REFRESH_AUTO_INTERVAL_MS) return
  await enqueueRefresh()
}

function update(sql: string, ...values: unknown[]) {
  getRuntime().database.prepare(`UPDATE cloudflare_refresh_jobs SET ${sql} WHERE tournament_id=?`).run(...values, currentTournamentId())
}
function nextPlayer() { update("cursor=cursor+1,stage='rank',match_ids='[]',match_cursor=0,puuid='',attempts=0,due=?", Date.now() + 1000) }
function currentTarget(target: Target) {
  return getTeams().flatMap(team => team.players.map(player => ({ player, team })))
    .find(value => value.player.id === target.playerId && value.player.summonerName === target.summonerName)
}

async function step(current: Job): Promise<void> {
  const targets = JSON.parse(current.targets) as Target[]
  const target = targets[current.cursor]
  if (!target) { update('running=0'); return }
  const found = currentTarget(target)
  if (!found) { nextPlayer(); return }

  if (current.stage === 'rank') {
    const row = await loadPlayerRow(found.player, found.team, buildChampionMap(), false)
    // Read after I/O to retain concurrent updates to other players.
    const fresh = getTeams().some(team => team.players.some(player => player.id === target.playerId && player.summonerName === target.summonerName))
    if (!fresh) { nextPlayer(); return }
    const cache = getPlayerStatsCache()
    savePlayerStatsCache({ lastUpdated: new Date().toISOString(), players: [...cache.players.filter(p => p.playerId !== row.playerId), row] })
    update("stage='mastery',puuid=?,attempts=0,due=?", row.puuid, Date.now() + 1000)
    if (!row.puuid) nextPlayer()
  } else if (current.stage === 'mastery') {
    const map = buildChampionMap()
    const masteries = await getChampionMastery(current.puuid)
    if (!currentTarget(target)) { nextPlayer(); return }
    savePlayerMastery(target.playerId, target.summonerName, masteries.map(m => ({ championId: m.championId,
      championName: map.get(m.championId) ?? `Champion_${m.championId}`, masteryLevel: m.championLevel,
      masteryPoints: m.championPoints, lastPlayedAt: m.lastPlayTime, updatedAt: new Date().toISOString() })))
    update("stage='history',attempts=0,due=?", Date.now() + 1000)
  } else if (current.stage === 'history') {
    const ids = await getMatchIds(current.puuid, 100)
    if (!currentTarget(target)) { nextPlayer(); return }
    const stored = getStoredMatchIds(target.playerId)
    update("stage='matches',match_ids=?,match_cursor=0,attempts=0,due=?", JSON.stringify(ids.filter(id => !stored.has(id))), Date.now() + 1000)
  } else {
    const ids = JSON.parse(current.match_ids) as string[]
    const matchId = ids[current.match_cursor]
    if (!matchId) { nextPlayer(); return }
    const match = await getMatchDetails(matchId) as { info: { gameCreation: number; queueId: number; participants: Array<{
      puuid: string; championId: number; championName: string; teamPosition: string; kills: number; deaths: number; assists: number; win: boolean
    }> } }
    const player = match.info.participants.find(p => p.puuid === current.puuid)
    if (!currentTarget(target)) { nextPlayer(); return }
    if (player) savePlayerMatches(target.playerId, target.summonerName, [{ matchId, championId: player.championId,
      championName: player.championName, position: player.teamPosition || 'UNKNOWN', kills: player.kills, deaths: player.deaths,
      assists: player.assists, win: player.win, playedAt: match.info.gameCreation, queueId: match.info.queueId }])
    // Upserts make replay safe if eviction occurs after saving a match.
    update('match_cursor=match_cursor+1,attempts=0,due=?', Date.now() + 1000)
  }
}

export async function processRefreshJobs(): Promise<void> {
  const rows = getRuntime().database.prepare('SELECT * FROM cloudflare_refresh_jobs WHERE running=1 AND due<=? ORDER BY due LIMIT 1').all(Date.now()) as Job[]
  for (const row of rows) await inTournament(row.tournament_id, async () => {
    try { await step(row) } catch (error) {
      if (error instanceof RiotApiKeyError) update('running=0,key_expired=1')
      else if (error instanceof RiotRetryDeferred) update('due=?', Date.now() + error.delayMs)
      else if (row.attempts < 3) update('attempts=attempts+1,due=?', Date.now() + 30000 * 2 ** row.attempts)
      else if (row.stage === 'matches') update('match_cursor=match_cursor+1,attempts=0,due=?', Date.now() + 1000)
      else {
        if (row.stage === 'rank') {
          const target = (JSON.parse(row.targets) as Target[])[row.cursor]
          const found = target && currentTarget(target)
          if (found) {
            const cache = getPlayerStatsCache()
            const previous = cache.players.find(player => player.playerId === target.playerId)
            const fallback = failedPlayerRow(found.player, found.team, previous)
            savePlayerStatsCache({ lastUpdated: new Date().toISOString(), players: [...cache.players.filter(player => player.playerId !== target.playerId), fallback] })
          }
        }
        nextPlayer()
      }
    }
  })
  const next = getRuntime().database.prepare('SELECT MIN(due) AS due FROM cloudflare_refresh_jobs WHERE running=1').get() as { due: number | null }
  if (next.due !== null) await scheduleWork(Math.max(Date.now() + 1000, next.due))
}
