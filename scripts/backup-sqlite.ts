/**
 * Create and validate an online SQLite backup.
 *
 * The backup API is used instead of copying the database file directly. This
 * is important while the application is using WAL mode: a file copy can miss
 * committed pages which are still in the WAL file.
 *
 * Usage:
 *   npx tsx scripts/backup-sqlite.ts             # one backup
 *   npx tsx scripts/backup-sqlite.ts --loop      # scheduled worker
 *   npx tsx scripts/backup-sqlite.ts --verify file.db
 */

import './load-env'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readdir, rename, rm, stat } from 'fs/promises'
import path from 'path'

const DEFAULT_SOURCE = path.join(process.cwd(), 'data', 'esigglol.db')
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), 'backups')
const DEFAULT_RETENTION = 7
const DEFAULT_INTERVAL_SECONDS = 24 * 60 * 60

function positiveInt(name: string, fallback: number): number {
  const value = process.env[name]
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isEnabled(): boolean {
  return (process.env.BACKUP_ENABLED ?? 'true').toLowerCase() !== 'false'
}

function sourcePath(): string {
  return path.resolve(process.env.DB_PATH ?? DEFAULT_SOURCE)
}

function backupDirectory(): string {
  return path.resolve(process.env.BACKUP_DIR ?? DEFAULT_BACKUP_DIR)
}

function backupPrefix(): string {
  const value = process.env.BACKUP_FILENAME_PREFIX ?? 'esigglol'
  // A prefix is used in a filename, never as a path. Refuse separators rather
  // than allowing an accidental write outside BACKUP_DIR.
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error('BACKUP_FILENAME_PREFIX must contain only letters, numbers, "-" or "_"')
  }
  return value
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function checkIntegrity(filename: string): void {
  const db = new Database(filename, { readonly: true, fileMustExist: true })
  try {
    db.pragma('busy_timeout = 10000')
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>
    if (result.length !== 1 || result[0].integrity_check !== 'ok') {
      throw new Error(`SQLite integrity check failed for ${filename}`)
    }
  } finally {
    db.close()
  }
}

/** Create one atomic, consistent snapshot and return its final path. */
export async function createBackup(): Promise<string> {
  const source = sourcePath()
  const destinationDir = backupDirectory()

  if (!existsSync(source)) {
    throw new Error(`SQLite database does not exist: ${source}`)
  }
  await mkdir(destinationDir, { recursive: true })

  const finalPath = path.join(destinationDir, `${backupPrefix()}-${timestamp()}.db`)
  const temporaryPath = path.join(destinationDir, `.${path.basename(finalPath)}.${randomUUID()}.tmp`)
  const sourceDb = new Database(source, { readonly: true, fileMustExist: true })

  try {
    sourceDb.pragma('busy_timeout = 10000')
    // better-sqlite3 uses SQLite's online backup API. Returning a small delay
    // allows writers to proceed when a large database needs many pages.
    await sourceDb.backup(temporaryPath, { progress: () => 20 })
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    sourceDb.close()
  }

  try {
    checkIntegrity(temporaryPath)
    await rename(temporaryPath, finalPath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }

  return finalPath
}

export async function rotateBackups(): Promise<void> {
  const directory = backupDirectory()
  const prefix = `${backupPrefix()}-`
  const retention = positiveInt('BACKUP_RETENTION_COUNT', DEFAULT_RETENTION)
  const entries = await readdir(directory, { withFileTypes: true })
  const candidates: Array<{ name: string; mtimeMs: number }> = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith('.db')) continue
    const file = path.join(directory, entry.name)
    candidates.push({ name: entry.name, mtimeMs: (await stat(file)).mtimeMs })
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
  for (const candidate of candidates.slice(retention)) {
    await rm(path.join(directory, candidate.name))
  }
}

export function verifyBackup(filename: string): void {
  checkIntegrity(path.resolve(filename))
}

async function runOnce(): Promise<void> {
  const created = await createBackup()
  await rotateBackups()
  console.log(`[backup] created and verified ${created}`)
}

async function sleep(seconds: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, seconds * 1000))
}

async function runLoop(): Promise<void> {
  if (!isEnabled()) {
    console.log('[backup] BACKUP_ENABLED=false; backup worker is idle')
    // Keep the container alive without a tight restart loop from Compose's
    // `restart: unless-stopped` policy.
    for (;;) await sleep(60 * 60)
    return
  }

  const interval = positiveInt('BACKUP_INTERVAL_SECONDS', DEFAULT_INTERVAL_SECONDS)
  const retryInterval = positiveInt('BACKUP_RETRY_INTERVAL_SECONDS', 300)
  const runOnStart = (process.env.BACKUP_RUN_ON_START ?? 'true').toLowerCase() !== 'false'

  let waitSeconds = runOnStart ? 0 : interval

  for (;;) {
    if (waitSeconds > 0) await sleep(waitSeconds)
    try {
      await runOnce()
      waitSeconds = interval
    } catch (error) {
      // Keep the worker alive so a transient lock or volume error is retried.
      // The error is intentionally written to container logs for monitoring.
      console.error('[backup] scheduled backup failed:', error)
      waitSeconds = retryInterval
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args[0] === '--verify') {
    if (!args[1]) throw new Error('Usage: --verify <backup-file>')
    verifyBackup(args[1])
    console.log(`[backup] verified ${path.resolve(args[1])}`)
    return
  }
  if (args.includes('--loop')) {
    await runLoop()
    return
  }
  if (!isEnabled()) {
    console.log('[backup] BACKUP_ENABLED=false; nothing to do')
    return
  }
  await runOnce()
}

// Keep the module importable for tests without executing the CLI. `tsx` may
// transpile this file as CommonJS, so use the script basename instead of
// import.meta/require interop here.
if (['backup-sqlite.ts', 'backup-sqlite.js'].includes(path.basename(process.argv[1] ?? ''))) {
  main().catch(error => {
    console.error('[backup] fatal:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
