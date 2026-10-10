import path from 'node:path'
import { getRuntime } from './context'
import assets from './assets'
import { scheduleWork } from './schedule'
import { StorageQuotaError } from '../lib/storage-quota'

export const FILE_LIMITS = Object.freeze({ classA: 1000, classB: 50000, bytes: 64 * 1024 * 1024, objectBytes: 2 * 1024 * 1024 })
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' }

export class FileQuotaError extends StorageQuotaError {}

function key(filePath: string): string {
  const name = path.basename(filePath)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(name) || name.endsWith('.') || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) || !filePath.replaceAll('\\', '/').endsWith(`/uploads/${name}`)) throw new Error('Invalid upload path')
  return name
}

async function reserve(a: number, b: number, bytes: number): Promise<void> {
  const { env } = getRuntime()
  if (!await env.FILE_BUDGET.getByName('esigglol-application').reserve(a, b, bytes)) throw new FileQuotaError()
}

export async function mkdir(_path: string, _options?: unknown): Promise<void> { void _path; void _options }

export async function writeFile(filePath: string, bytes: Uint8Array, _options?: unknown): Promise<void> {
  void _options
  const filename = key(filePath)
  if (bytes.byteLength > FILE_LIMITS.objectBytes) throw new Error('Upload exceeds maximum size')
  const { database, env } = getRuntime()
  const metadata = { contentType: TYPES[filename.split('.').pop() ?? ''] ?? 'application/octet-stream' }
  // This lifetime ceiling never refunds failed requests, replacements or deletes.
  await reserve(1, 0, bytes.byteLength + new TextEncoder().encode(JSON.stringify(metadata)).byteLength)
  database.prepare("INSERT INTO cloudflare_files (name, state, created_at) VALUES (?, 'staging', ?)").run(filename, Date.now())
  await scheduleWork(Date.now() + 300000)
  await env.FILES.put(filename, bytes, { storageClass: 'Standard', httpMetadata: metadata })
  database.prepare("UPDATE cloudflare_files SET state='live' WHERE name=? AND state='staging'").run(filename)
}

export async function readFile(filePath: string): Promise<Buffer> {
  const icon = /\/ddragon\/profileicon\/(\d+)\.png$/.exec(filePath.replaceAll('\\', '/'))
  if (icon) {
    if (!assets.version) throw new Error('DDragon version unavailable')
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${assets.version}/img/profileicon/${icon[1]}.png`, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw Object.assign(new Error('Profile icon not found'), { code: 'ENOENT' })
    if (Number(response.headers.get('content-length')) > FILE_LIMITS.objectBytes) throw new Error('Profile icon exceeds maximum size')
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > FILE_LIMITS.objectBytes) throw new Error('Profile icon exceeds maximum size')
    return Buffer.from(bytes)
  }
  const filename = key(filePath)
  await reserve(0, 1, 0)
  const object = await getRuntime().env.FILES.get(filename)
  if (!object) throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
  return Buffer.from(await object.arrayBuffer())
}

const references = `SELECT json_extract(data, '$.logo') AS logo FROM teams
  UNION ALL SELECT json_extract(payload, '$.logo') FROM team_change_requests WHERE status='pending' AND type='team_logo'
  UNION ALL SELECT json_extract(data, '$.logo') FROM tournament_config WHERE key='site-branding'`
const unreferenced = `FROM cloudflare_files WHERE state IN ('staging','live')
  AND NOT EXISTS (SELECT 1 FROM (${references}) WHERE logo='/api/uploads/' || cloudflare_files.name)`

export function isReferenced(filename: string): boolean {
  return Boolean(getRuntime().database.prepare(`SELECT 1 FROM (${references}) WHERE logo=? LIMIT 1`).get(`/api/uploads/${filename}`))
}

export async function unlink(filePath: string): Promise<void> {
  const filename = key(filePath)
  const { database, env } = getRuntime()
  const claimed = database.transaction(() => {
    if (isReferenced(filename)) return false
    database.prepare("INSERT INTO cloudflare_files (name,state) VALUES (?, 'deleting') ON CONFLICT(name) DO UPDATE SET state='deleting'").run(filename)
    return true
  }).immediate()
  if (!claimed) return
  await env.FILES.delete(filename)
  database.prepare("UPDATE cloudflare_files SET state='deleted' WHERE name=?").run(filename)
}

export async function collectGarbage(): Promise<void> {
  const { database } = getRuntime()
  try {
    // Filter references before LIMIT so older live logos cannot starve orphans.
    const stale = database.prepare(`SELECT name ${unreferenced} AND created_at<=? ORDER BY created_at LIMIT 10`).all(Date.now() - 300000) as Array<{ name: string }>
    for (const row of stale) database.prepare("UPDATE cloudflare_files SET state='deleting' WHERE name=?").run(row.name)
    const rows = database.prepare("SELECT name FROM cloudflare_files WHERE state='deleting' LIMIT 10").all() as Array<{ name: string }>
    for (const row of rows) await unlink(`/data/uploads/${row.name}`)
  } finally {
    // Each alarm handles a bounded batch, then schedules young or remaining
    // orphans even if there are no further uploads or Riot refreshes.
    const next = database.prepare(`SELECT MIN(created_at) AS created_at ${unreferenced}`).get() as { created_at: number | null }
    if (next.created_at !== null) await scheduleWork(Math.max(Date.now() + 1000, next.created_at + 300000))
    if (database.prepare("SELECT 1 FROM cloudflare_files WHERE state='deleting' LIMIT 1").get()) await scheduleWork(Date.now() + 60000)
  }
}
