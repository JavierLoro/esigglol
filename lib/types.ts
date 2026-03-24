// ── Equipos y jugadores ──────────────────────────────────────────────────────

export type Role = 'Top' | 'Jungle' | 'Mid' | 'Bot' | 'Support' | 'Fill' | 'Suplente'

export interface Player {
  id: string
  summonerName: string // "Nick#TAG"
  primaryRole: Role
  secondaryRole?: Exclude<Role, 'Suplente'>
}

export interface Team {
  id: string
  name: string
  logo: string // ruta relativa a /public
  players: Player[]
}

// ── Fases ────────────────────────────────────────────────────────────────────

export type PhaseType = 'groups' | 'swiss' | 'upper-lower' | 'final-four' | 'elimination'
export type PhaseStatus = 'upcoming' | 'active' | 'completed'
export type BOFormat = 1 | 2 | 3 | 5

export interface GroupConfig {
  id: string
  teamIds: string[]
}

export interface PhaseConfig {
  bo: BOFormat
  advanceCount?: number        // para grupos: cuántos equipos pasan por grupo
  groups?: GroupConfig[]       // para type=groups
  rounds?: number              // para swiss: número máximo de rondas
  swissTeamIds?: string[]      // pool de equipos en el suizo
  swissSize?: 8 | 16           // tamaño del suizo
  advanceWins?: number         // victorias para clasificarse
  eliminateLosses?: number     // derrotas para eliminarse
  roundBo?: Record<string, BOFormat>  // BO por ronda (clave = número de ronda como string)
  confirmedRounds?: number[]           // swiss: rondas confirmadas (visibles al público)
  bracketTeamIds?: string[]            // equipos para elimination/final-four/upper-lower
  include3rdPlace?: boolean            // solo final-four: generar partido de 3er puesto
}

export interface Phase {
  id: string
  name: string
  type: PhaseType
  status: PhaseStatus
  order: number
  config: PhaseConfig
}

// ── Partidos ─────────────────────────────────────────────────────────────────

export interface MatchResult {
  team1Score: number
  team2Score: number
}

export interface GamePlayerData {
  summonerName: string
  championName: string         // DDragon key (e.g. "Yone", "MonkeyKing")
  level: number
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  items: string[]              // up to 8: 6 items + trinket + boots (ADC boot mission)
  keystone: string             // primary keystone rune name
}

export interface GameData {
  duration: string             // "36:22"
  date?: string                // "03/18/2026"
  winner: 'team1' | 'team2'
  team1Players: GamePlayerData[]
  team2Players: GamePlayerData[]
}

export interface Match {
  id: string
  phaseId: string
  round: number
  team1Id: string
  team2Id: string
  result: MatchResult | null   // null = pendiente
  winnerId?: string            // teamId del ganador (derivado del result, o asignado manualmente)
  riotMatchIds: string[]       // IDs de partidas reales en Riot API
  games?: GameData[]           // parsed screenshot data, index = game number
  scheduledAt?: string         // ISO date string opcional
  tournamentCodes?: string[]   // Tournament codes, one per game in BO series
}

// ── Tournament API ──────────────────────────────────────────────────────────

export interface TournamentConfig {
  providerId: number
  tournamentId: number
}

export interface LobbyEvent {
  summonerName: string
  eventType: string
  timestamp: string
}

// ── Riot API ─────────────────────────────────────────────────────────────────

export interface RiotSummoner {
  puuid: string
  profileIconId: number
  summonerLevel: number
}

export type RiotTier =
  | 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD'
  | 'PLATINUM' | 'EMERALD' | 'DIAMOND'
  | 'MASTER' | 'GRANDMASTER' | 'CHALLENGER'
  | 'UNRANKED'

export type RiotRank = 'I' | 'II' | 'III' | 'IV'

export interface RiotLeagueEntry {
  queueType: string
  tier: RiotTier
  rank: RiotRank
  leaguePoints: number
  wins: number
  losses: number
}

export interface PlayerStats {
  summonerName: string
  puuid: string
  profileIconId: number
  level: number
  tier: RiotTier
  rank: RiotRank
  lp: number
  wins: number
  losses: number
  winrate: number      // porcentaje 0-100
}

export interface PlayerRow extends PlayerStats {
  teamId: string
  teamName: string
  teamLogo: string
  primaryRole: string
  secondaryRole?: string
  apiError?: boolean
}
