// Loads .env.local as a development fallback for scripts that run outside
// Next.js. Production must receive secrets from the runtime/secret manager.

import { readFileSync } from 'fs'
import { resolve } from 'path'

export function loadLocalEnv(
  target: NodeJS.ProcessEnv = process.env,
  filePath = resolve(process.cwd(), '.env.local'),
): boolean {
  if (target.NODE_ENV === 'production') return false

  try {
    const env = readFileSync(filePath, 'utf-8')
    for (const line of env.split('\n')) {
      const eq = line.indexOf('=')
      if (eq === -1 || line.trim().startsWith('#')) continue
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim()
      if (k && !(k in target)) target[k] = v
    }
    return true
  } catch {
    return false
  }
}

loadLocalEnv()
