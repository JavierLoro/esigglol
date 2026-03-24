/**
 * collect-stats-dev.ts
 * Colección de stats de Riot API respetando los límites de dev key (100 req / 120s).
 *
 * Uso:
 *   npm run collect-stats-dev                  # todos los jugadores en la DB
 *   npm run collect-stats-dev "Nombre#TAG"     # solo un jugador
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

// ── Rate limiter (dev key: 100 req / 120s, 20 req / 1s) ──────────────────────

class RateLimiter {
  private windowStart = Date.now()
  private windowCount = 0
  private readonly maxPerWindow = 95   // buffer de 5 sobre el límite real de 100
  private readonly windowMs = 122_000  // 2 minutos + 2s de margen

  async throttle(): Promise<void> {
    const now = Date.now()
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now
      this.windowCount = 0
    }
    if (this.windowCount >= this.maxPerWindow) {
      const wait = this.windowMs - (Date.now() - this.windowStart)
      console.log(`  [rate limit] ventana llena, esperando ${Math.ceil(wait / 1000)}s...`)
      await sleep(wait)
      this.windowStart = Date.now()
      this.windowCount = 0
    }
    this.windowCount++
    await sleep(100) // 100ms entre requests = máx 10 req/s, lejos del límite de 20/s
  }

  get used(): number { return this.windowCount }
}

const limiter = new RateLimiter()

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function riotGet<T>(url: string): Promise<T> {
  await limiter.throttle()
  const res = await fetch(url, { headers: { 'X-Riot-Token': API_KEY! } })
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
  console.log(`\n[${nameTag}]`)

  // 1. PUUID
  const account = await riotGet<{ puuid: string }>(
    `https://${MATCH_CLUSTER}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  )
  const { puuid } = account

  // 2. Champion mastery (top 50)
  const masteries = await riotGet<Array<{
    championId: number; championLevel: number; championPoints: number; lastPlayTime: number
  }>>(`${BASE}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=50`)

  savePlayerMastery(nameTag, masteries.map(m => ({
    championId: m.championId,
    championName: championMap.get(m.championId) ?? `Champion_${m.championId}`,
    masteryLevel: m.championLevel,
    masteryPoints: m.championPoints,
    lastPlayedAt: m.lastPlayTime,
    updatedAt: new Date().toISOString(),
  })))
  console.log(`  maestria: ${masteries.length} campeones guardados`)

  // 3. Match IDs (ranked solo, desde inicio de temporada, hasta 100)
  const matchIds = await riotGet<string[]>(
    `${MATCH_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&startTime=${SEASON_START_S}&count=100`
  )

  // 4. Deduplicar contra lo ya almacenado
  const stored = getStoredMatchIds(nameTag)
  const newIds = matchIds.filter(id => !stored.has(id))
  console.log(`  partidas: ${matchIds.length} en temporada, ${stored.size} ya almacenadas, ${newIds.length} nuevas`)

  if (newIds.length === 0) return

  // 5. Fetch y almacenar cada partida nueva
  let fetched = 0
  const toSave: Parameters<typeof savePlayerMatches>[1] = []

  for (const matchId of newIds) {
    const match = await riotGet<{
      info: {
        gameCreation: number; queueId: number
        participants: Array<{
          puuid: string; championId: number; championName: string; teamPosition: string
          kills: number; deaths: number; assists: number; win: boolean
        }>
      }
    }>(`${MATCH_BASE}/lol/match/v5/matches/${matchId}`)

    const p = match.info.participants.find(p => p.puuid === puuid)
    if (!p) continue

    toSave.push({
      matchId,
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
    fetched++
    process.stdout.write(`\r  partidas nuevas: ${fetched}/${newIds.length} (req en ventana: ${limiter.used}/95)`)
  }

  savePlayerMatches(nameTag, toSave)
  console.log(`\n  guardadas ${toSave.length} partidas nuevas`)
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
    // Leer todos los jugadores de la DB
    const db = new Database(resolve(process.cwd(), 'esigglol.db'))
    const teams = db.prepare('SELECT data FROM teams').all() as Array<{ data: string }>
    players = teams.flatMap(t => {
      const team = JSON.parse(t.data) as { players: Array<{ summonerName: string }> }
      return team.players.map(p => p.summonerName)
    })
    db.close()
    console.log(`Jugadores encontrados en la DB: ${players.length}`)
  }

  const start = Date.now()
  let ok = 0
  let failed = 0

  for (const nameTag of players) {
    try {
      await collectPlayer(nameTag, championMap)
      ok++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`\n  ERROR: ${msg}`)
      failed++
    }
  }

  const elapsed = Math.round((Date.now() - start) / 1000)
  const min = Math.floor(elapsed / 60)
  const sec = elapsed % 60
  console.log(`\n=== Fin: ${ok} OK, ${failed} errores | tiempo: ${min}m${sec}s ===`)
}

main().catch(err => {
  console.error('Error fatal:', err.message)
  process.exit(1)
})
