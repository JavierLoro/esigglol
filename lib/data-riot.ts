import db from './db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MasteryRow {
  summonerName: string
  championId: number
  championName: string
  masteryLevel: number
  masteryPoints: number
  lastPlayedAt: number  // ms timestamp
  updatedAt: string
}

export interface MatchRow {
  summonerName: string
  matchId: string
  championId: number
  championName: string
  position: string
  kills: number
  deaths: number
  assists: number
  win: boolean
  playedAt: number  // ms timestamp
  queueId: number
}

export interface ChampionStat {
  championName: string
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
  kda: number   // (K+A)/D, redondeado a 2 decimales
  winrate: number  // 0-100
}

export interface RecentChampion {
  championName: string
  games: number
  wins: number
}

// ── Player cooldown ──────────────────────────────────────────────────────────

export function getPlayerLastUpdated(summonerName: string): string | null {
  const row = db.prepare(
    'SELECT MAX(updated_at) as last FROM player_champion_mastery WHERE summoner_name = ?'
  ).get(summonerName) as { last: string | null } | undefined
  return row?.last ?? null
}

// ── Champion mastery ──────────────────────────────────────────────────────────

export function savePlayerMastery(summonerName: string, masteries: Omit<MasteryRow, 'summonerName'>[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO player_champion_mastery
      (summoner_name, champion_id, champion_name, mastery_level, mastery_points, last_played_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    for (const m of masteries) {
      stmt.run(summonerName, m.championId, m.championName, m.masteryLevel, m.masteryPoints, m.lastPlayedAt, m.updatedAt)
    }
  })()
}

export function getPlayerMastery(summonerName: string): MasteryRow[] {
  return (db.prepare(`
    SELECT summoner_name, champion_id, champion_name, mastery_level, mastery_points, last_played_at, updated_at
    FROM player_champion_mastery
    WHERE summoner_name = ?
    ORDER BY mastery_points DESC
  `).all(summonerName) as Array<Record<string, unknown>>).map(r => ({
    summonerName: r.summoner_name as string,
    championId: r.champion_id as number,
    championName: r.champion_name as string,
    masteryLevel: r.mastery_level as number,
    masteryPoints: r.mastery_points as number,
    lastPlayedAt: r.last_played_at as number,
    updatedAt: r.updated_at as string,
  }))
}

// ── Match history ─────────────────────────────────────────────────────────────

export function savePlayerMatches(summonerName: string, matches: Omit<MatchRow, 'summonerName'>[]): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO player_match_history
      (summoner_name, match_id, champion_id, champion_name, position, kills, deaths, assists, win, played_at, queue_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    for (const m of matches) {
      stmt.run(summonerName, m.matchId, m.championId, m.championName, m.position,
        m.kills, m.deaths, m.assists, m.win ? 1 : 0, m.playedAt, m.queueId)
    }
  })()
}

export function getStoredMatchIds(summonerName: string): Set<string> {
  const rows = db.prepare('SELECT match_id FROM player_match_history WHERE summoner_name = ?').all(summonerName) as Array<{ match_id: string }>
  return new Set(rows.map(r => r.match_id))
}

export function getPlayerMatchHistory(summonerName: string, limit = 100): MatchRow[] {
  return (db.prepare(`
    SELECT summoner_name, match_id, champion_id, champion_name, position, kills, deaths, assists, win, played_at, queue_id
    FROM player_match_history
    WHERE summoner_name = ?
    ORDER BY played_at DESC
    LIMIT ?
  `).all(summonerName, limit) as Array<Record<string, unknown>>).map(r => ({
    summonerName: r.summoner_name as string,
    matchId: r.match_id as string,
    championId: r.champion_id as number,
    championName: r.champion_name as string,
    position: r.position as string,
    kills: r.kills as number,
    deaths: r.deaths as number,
    assists: r.assists as number,
    win: (r.win as number) === 1,
    playedAt: r.played_at as number,
    queueId: r.queue_id as number,
  }))
}

// ── Aggregations ──────────────────────────────────────────────────────────────

// KDA medio y partidas jugadas por campeón, filtrado por cola y desde seasonStart.
// Si minMatches > 0 y hay menos partidas en la ventana temporal, usa las últimas minMatches partidas.
export function getChampionStats(summonerName: string, seasonStartMs: number, queueId = 420, minMatches = 0): ChampionStat[] {
  const rows = db.prepare(`
    SELECT
      champion_name,
      COUNT(*)        AS games,
      SUM(win)        AS wins,
      SUM(kills)      AS kills,
      SUM(deaths)     AS deaths,
      SUM(assists)    AS assists
    FROM player_match_history
    WHERE summoner_name = ?
      AND queue_id = ?
      AND played_at >= ?
    GROUP BY champion_name
    ORDER BY games DESC
  `).all(summonerName, queueId, seasonStartMs) as Array<Record<string, number | string>>

  const totalGames = rows.reduce((sum, r) => sum + (r.games as number), 0)

  // Fallback: si hay menos partidas que minMatches, usar las últimas minMatches partidas
  if (minMatches > 0 && totalGames < minMatches) {
    const fallbackRows = db.prepare(`
      SELECT
        champion_name,
        COUNT(*)        AS games,
        SUM(win)        AS wins,
        SUM(kills)      AS kills,
        SUM(deaths)     AS deaths,
        SUM(assists)    AS assists
      FROM (
        SELECT champion_name, win, kills, deaths, assists
        FROM player_match_history
        WHERE summoner_name = ?
          AND queue_id = ?
        ORDER BY played_at DESC
        LIMIT ?
      )
      GROUP BY champion_name
      ORDER BY games DESC
    `).all(summonerName, queueId, minMatches) as Array<Record<string, number | string>>

    return mapChampionRows(fallbackRows)
  }

  return mapChampionRows(rows)
}

function mapChampionRows(rows: Array<Record<string, number | string>>): ChampionStat[] {
  return rows.map(r => {
    const games = r.games as number
    const wins = r.wins as number
    const kills = r.kills as number
    const deaths = r.deaths as number
    const assists = r.assists as number
    const kda = deaths === 0 ? kills + assists : Math.round(((kills + assists) / deaths) * 100) / 100
    return {
      championName: r.champion_name as string,
      games,
      wins,
      kills,
      deaths,
      assists,
      kda,
      winrate: Math.round((wins / games) * 100),
    }
  })
}

// Top 5 campeones más jugados en las últimas N partidas almacenadas
export function getTopRecentChampions(summonerName: string, lastN = 20, top = 5): RecentChampion[] {
  return (db.prepare(`
    SELECT champion_name, COUNT(*) AS games, SUM(win) AS wins
    FROM (
      SELECT champion_name, win
      FROM player_match_history
      WHERE summoner_name = ?
      ORDER BY played_at DESC
      LIMIT ?
    )
    GROUP BY champion_name
    ORDER BY games DESC
    LIMIT ?
  `).all(summonerName, lastN, top) as Array<Record<string, unknown>>).map(r => ({
    championName: r.champion_name as string,
    games: r.games as number,
    wins: r.wins as number,
  }))
}
