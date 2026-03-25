// Centralized environment variable access.
// All env vars are read and validated here so the rest of the codebase
// imports from this module instead of accessing process.env directly.

import path from 'path'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} env var is required`)
  return value
}

// ── Required ─────────────────────────────────────────────────────────────────

export const SESSION_SECRET = required('SESSION_SECRET')
// bcrypt hashes contain $ which dotenv-expand interprets as variable references.
// In Docker (env_file with single quotes) the value arrives intact.
// In Next.js dev, dotenv-expand corrupts it. Fall back to reading .env.local raw.
export const ADMIN_PASSWORD_HASH = (() => {
  const val = process.env.ADMIN_PASSWORD_HASH
  if (val && val.startsWith('$2')) return val
  // dotenv-expand corrupted the value — read raw from .env.local
  try {
    const fs = require('fs') as typeof import('fs')
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
    const match = raw.match(/^ADMIN_PASSWORD_HASH='([^']+)'/m)
      ?? raw.match(/^ADMIN_PASSWORD_HASH=(.+)$/m)
    if (match?.[1]) return match[1]
  } catch { /* file may not exist in Docker */ }
  if (!val) throw new Error('ADMIN_PASSWORD_HASH env var is required')
  return val
})()
export const RIOT_API_KEY = required('RIOT_API_KEY')

// ── Optional (with defaults) ─────────────────────────────────────────────────

export const RIOT_REGION = process.env.RIOT_REGION || 'euw1'
export const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL ?? ''
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ── Paths ────────────────────────────────────────────────────────────────────

export const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'esigglol.db')
export const DATA_DIR = path.dirname(DB_PATH)
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

// ── Derived ──────────────────────────────────────────────────────────────────

export const MATCH_CLUSTER = RIOT_REGION.startsWith('na')
  ? 'americas'
  : RIOT_REGION.startsWith('kr')
    ? 'asia'
    : 'europe'

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
