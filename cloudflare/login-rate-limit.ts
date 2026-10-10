import { getRuntime } from './context'

export const LOGIN_SCHEMA = `CREATE TABLE IF NOT EXISTS cloudflare_login_attempts (scope TEXT NOT NULL, ip TEXT NOT NULL, count INTEGER NOT NULL, reset_at INTEGER NOT NULL, PRIMARY KEY(scope,ip))`
export function consumeLoginAttempt(scope: string, ip: string, max: number): boolean {
  const { database } = getRuntime()
  return database.transaction(() => {
    const now = Date.now()
    database.prepare('DELETE FROM cloudflare_login_attempts WHERE reset_at<=?').run(now)
    const row = database.prepare('SELECT count FROM cloudflare_login_attempts WHERE scope=? AND ip=?').get(scope, ip) as { count: number } | undefined
    if (row && row.count >= max) return false
    if (!row && (database.prepare('SELECT COUNT(*) AS n FROM cloudflare_login_attempts').get() as { n: number }).n >= 10000) return false
    database.prepare(`INSERT INTO cloudflare_login_attempts(scope,ip,count,reset_at) VALUES(?,?,1,?)
      ON CONFLICT(scope,ip) DO UPDATE SET count=count+1`).run(scope, ip, now + 900000)
    return true
  }).immediate()
}
export function clearLoginAttempts(scope: string, ip: string): void { getRuntime().database.prepare('DELETE FROM cloudflare_login_attempts WHERE scope=? AND ip=?').run(scope, ip) }
