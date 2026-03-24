/**
 * collect-stats-prod.ts
 * Colección de stats de Riot API para production key (3000+ req/10s).
 * Procesa hasta CONCURRENCY jugadores en paralelo sin delays artificiales.
 *
 * Uso:
 *   npm run collect-stats-prod                 # todos los jugadores en la DB
 *   npm run collect-stats-prod "Nombre#TAG"    # solo un jugador
 */

import './load-env'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { savePlayerMastery, savePlayerMatches, getStoredMatchIds } from '../lib/data-riot'

// ── Env ───────────────────────────────────────────────────────────────────────

const API_KEY = process.env.RIOT_API_KEY
if (!API_KEY) { console.error('Error: RIOT_API_KEY env var not found'); process.exit(1) }

const REGION = process.env.RIOT_REGION || 'euw1'
const MATCH_CLUSTER = REGION.startsWith('na') ? 'americas' : REGION.startsWith('kr') ? 'asia' : 'europe'
const BASE = `https://${REGION}.api.riotgames.com`
const MATCH_BASE = `https://${MATCH_CLUSTER}.api.riotgames.com`

// Últimos 30 días
const SEASON_START_S = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

// Número de jugadores en paralelo (ajustar según límites de la production key)
const CONCURRENCY = 20

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function riotGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'X-Riot-Token': API_KEY! } })
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1') * 1000
    console.warn(`  [429] Esperando ${retryAfter}ms...`)
    await sleep(retryAfter)
    return riotGet<T>(url)
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return res.json() as Promise<T>
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ── DDragon champion map ──────────────────────────────────────────────────────

function buildChampionMap(): Map<number, string> {
  const path = join(process.cwd(), 'public', 'ddragon', 'champion.json')
  const json = JSON.parse(readFileSync(path, 'utf-8')) as { data: Record<string, { key: string }> }
  const map = new Map<number, string>()
  for (const [name, data] of Object.entries(json.data)) {
    map.set(parseInt(data.key), name)
  }
  return map
}

// ── Collect one player ────────────────────────────────────────────────────────

async function collectPlayer(nameTag: string, championMap: Map<number, string>): Promise<void> {
  const [name, tag] = nameTag.split('#')

  // 1. PUUID
  const account = await riotGet<{ puuid: string }>(
    `https://${MATCH_CLUSTER}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  )
  const { puuid } = account

  // 2. Champion mastery (top 50) + match IDs en paralelo
  const [masteries, matchIds] = await Promise.all([
    riotGet<Array<{
      championId: number; championLevel: number; championPoints: number; lastPlayTime: number
    }>>(`${BASE}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=50`),
    riotGet<string[]>(
      `${MATCH_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&startTime=${SEASON_START_S}&count=100`
    ),
  ])

  savePlayerMastery(nameTag, masteries.map(m => ({
    championId: m.championId,
    championName: championMap.get(m.championId) ?? `Champion_${m.championId}`,
    masteryLevel: m.championLevel,
    masteryPoints: m.championPoints,
    lastPlayedAt: m.lastPlayTime,
    updatedAt: new Date().toISOString(),
  })))

  // 3. Deduplicar
  const stored = getStoredMatchIds(nameTag)
  const newIds = matchIds.filter(id => !stored.has(id))

  if (newIds.length === 0) {
    console.log(`[${nameTag}] maestria OK, ${matchIds.length} partidas ya almacenadas`)
    return
  }

  // 4. Fetch todas las partidas nuevas en paralelo (production key lo permite)
  const results = await Promise.allSettled(
    newIds.map(matchId =>
      riotGet<{
        info: {
          gameCreation: number; queueId: number
          participants: Array<{
            puuid: string; championId: number; championName: string; teamPosition: string
            kills: number; deaths: number; assists: number; win: boolean
          }>
        }
      }>(`${MATCH_BASE}/lol/match/v5/matches/${matchId}`)
    )
  )

  const toSave: Parameters<typeof savePlayerMatches>[1] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') continue
    const match = result.value
    const p = match.info.participants.find(p => p.puuid === puuid)
    if (!p) continue
    toSave.push({
      matchId: newIds[i],
      championId: p.championId,
      championName: p.championName,
      position: p.teamPosition || 'UNKNOWN',
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      win: p.win,
      playedAt: match.info.gameCreation,
      queueId: match.info.queueId,
    })
  }

  savePlayerMatches(nameTag, toSave)
  const errors = results.filter(r => r.status === 'rejected').length
  console.log(`[${nameTag}] maestria OK | +${toSave.length} partidas guardadas${errors ? ` (${errors} errores)` : ''}`)
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<{ ok: number; failed: number }> {
  let ok = 0
  let failed = 0
  let idx = 0

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const item = items[idx++]
      try {
        await fn(item)
        ok++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ERROR [${item}]: ${msg}`)
        failed++
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return { ok, failed }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const championMap = buildChampionMap()

  const singlePlayer = process.argv[2]

  let players: string[]
  if (singlePlayer) {
    if (!singlePlayer.includes('#')) {
      console.error('Formato incorrecto. Usa: "Nombre#TAG"')
      process.exit(1)
    }
    players = [singlePlayer]
  } else {
    const db = new Database(resolve(process.cwd(), 'esigglol.db'))
    const teams = db.prepare('SELECT data FROM teams').all() as Array<{ data: string }>
    players = teams.flatMap(t => {
      const team = JSON.parse(t.data) as { players: Array<{ summonerName: string }> }
      return team.players.map(p => p.summonerName)
    })
    db.close()
    console.log(`Jugadores encontrados en la DB: ${players.length} | Concurrencia: ${CONCURRENCY}`)
  }

  const start = Date.now()
  const { ok, failed } = await runWithConcurrency(players, p => collectPlayer(p, championMap), CONCURRENCY)

  const elapsed = Math.round((Date.now() - start) / 1000)
  const min = Math.floor(elapsed / 60)
  const sec = elapsed % 60
  console.log(`\n=== Fin: ${ok} OK, ${failed} errores | tiempo: ${min}m${sec}s ===`)
}

main().catch(err => {
  console.error('Error fatal:', err.message)
  process.exit(1)
})
