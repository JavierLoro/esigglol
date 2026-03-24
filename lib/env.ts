// Centralized environment variable access.
// All env vars are read and validated here so the rest of the codebase
// imports from this module instead of accessing process.env directly.

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} env var is required`)
  return value
}

// ── Required ─────────────────────────────────────────────────────────────────

export const SESSION_SECRET = required('SESSION_SECRET')
export const ADMIN_PASSWORD_HASH = required('ADMIN_PASSWORD_HASH')
export const RIOT_API_KEY = required('RIOT_API_KEY')

// ── Optional (with defaults) ─────────────────────────────────────────────────

export const RIOT_REGION = process.env.RIOT_REGION || 'euw1'
export const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL ?? ''
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ── Derived ──────────────────────────────────────────────────────────────────

export const MATCH_CLUSTER = RIOT_REGION.startsWith('na')
  ? 'americas'
  : RIOT_REGION.startsWith('kr')
    ? 'asia'
    : 'europe'

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
