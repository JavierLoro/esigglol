// Loads .env.local as a fallback for scripts that run outside Next.js.
// System environment variables always take precedence.

import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1 || line.trim().startsWith('#')) continue
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim()
    if (k && !(k in process.env)) process.env[k] = v
  }
} catch { /* .env.local not found — using system env vars */ }
