// Centralized environment variable access.
// All env vars are read and validated here so the rest of the codebase
// imports from this module instead of accessing process.env directly.

import path from 'path'
import { readFileSync } from 'fs'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} env var is required`)
  return value
}

function requiredSecret(name: string): string {
  const value = required(name)
  if (value.length < 32) {
    throw new Error(`${name} env var must be at least 32 characters long`)
  }
  return value
}

// Returns default when missing/invalid, accepts values >= 0.
function optionalNonNegativeInt(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) return defaultValue
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : defaultValue
}

// Returns default when missing/invalid, accepts values > 0.
function optionalPositiveInt(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) return defaultValue
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue
}

// ── Required ─────────────────────────────────────────────────────────────────

export const SESSION_SECRET = requiredSecret('SESSION_SECRET')
// bcrypt hashes contain $ which dotenv-expand interprets as variable references.
// In Docker (env_file with single quotes) the value arrives intact.
// In Next.js dev, dotenv-expand corrupts it. Fall back to reading .env.local raw.
// Production must only use the value injected by the runtime/secret manager.
export const ADMIN_PASSWORD_HASH = (() => {
  const val = process.env.ADMIN_PASSWORD_HASH
  if (val && val.startsWith('$2')) return val
  // dotenv-expand can corrupt local development values. Never read a local
  // file in production: the process environment is the source of truth there.
  if (process.env.NODE_ENV !== 'production') {
    try {
      const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
      const match = raw.match(/^ADMIN_PASSWORD_HASH='([^']+)'/m)
        ?? raw.match(/^ADMIN_PASSWORD_HASH=(.+)$/m)
      if (match?.[1]) return match[1]
    } catch { /* file may not exist */ }
  }
  if (!val) throw new Error('ADMIN_PASSWORD_HASH env var is required')
  return val
})()
export const RIOT_API_KEY = process.env.RIOT_API_KEY ?? ''

// ── Optional (with defaults) ─────────────────────────────────────────────────

export const RIOT_REGION = process.env.RIOT_REGION || 'euw1'
export const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL ?? ''
export const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? ''
export const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? ''
export const REFRESH_AUTO_INTERVAL_MS = optionalNonNegativeInt('REFRESH_AUTO_INTERVAL_MS', 6 * 60 * 60 * 1000)
export const REFRESH_BATCH_SIZE = optionalPositiveInt('REFRESH_BATCH_SIZE', 3)
export const REFRESH_BATCH_DELAY_MS = optionalNonNegativeInt('REFRESH_BATCH_DELAY_MS', 30_000)

// Riot exposes the Tournament API in two separate deployments. Keep the
// stub as the default so local environments do not accidentally make
// production requests; production must be explicitly opted into.
export type TournamentApiMode = 'stub' | 'production'
export const TOURNAMENT_API_MODE: TournamentApiMode =
  process.env.TOURNAMENT_API_MODE === 'production' ? 'production' : 'stub'

// ── Paths ────────────────────────────────────────────────────────────────────

export const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'esigglol.db')
export const DATA_DIR = path.dirname(DB_PATH)
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
export const PROFILE_ICONS_DIR = path.join(DATA_DIR, 'ddragon', 'profileicon')

// ── Derived ──────────────────────────────────────────────────────────────────

export const MATCH_CLUSTER = RIOT_REGION.startsWith('na')
  ? 'americas'
  : RIOT_REGION.startsWith('kr')
    ? 'asia'
    : 'europe'

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
