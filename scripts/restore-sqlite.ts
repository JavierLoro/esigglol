/**
 * Restore a verified SQLite backup into the configured database path.
 *
 * This command deliberately requires --force. Stop the app first so no
 * process can write the database while it is being replaced.
 *
 *   npx tsx scripts/restore-sqlite.ts --source backups/esigglol-....db --force
 */

import './load-env'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, rename, rm } from 'fs/promises'
import path from 'path'

const defaultDestination = path.resolve(process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'esigglol.db'))

function integrityCheck(filename: string): void {
  const db = new Database(filename, { readonly: true, fileMustExist: true })
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>
    if (result.length !== 1 || result[0].integrity_check !== 'ok') {
      throw new Error(`SQLite integrity check failed for ${filename}`)
    }
  } finally {
    db.close()
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const sourceIndex = args.indexOf('--source')
  const destinationIndex = args.indexOf('--destination')
  const source = sourceIndex >= 0 ? args[sourceIndex + 1] : undefined
  const destination = destinationIndex >= 0 ? path.resolve(args[destinationIndex + 1]) : defaultDestination

  if (!source || !existsSync(source)) throw new Error('Usage: --source <backup-file> [--destination <db>] --force')
  if (!args.includes('--force')) {
    throw new Error('Refusing to restore without --force. Stop the app and retry with --force.')
  }
  if (sourceIndex >= 0 && !args[sourceIndex + 1]) throw new Error('Missing value for --source')
  if (destinationIndex >= 0 && !args[destinationIndex + 1]) throw new Error('Missing value for --destination')

  const sourcePath = path.resolve(source)
  integrityCheck(sourcePath)
  await mkdir(path.dirname(destination), { recursive: true })

  const temporaryPath = `${destination}.${randomUUID()}.tmp`
  const sourceDb = new Database(sourcePath, { readonly: true, fileMustExist: true })
  try {
    await sourceDb.backup(temporaryPath, { progress: () => 20 })
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    sourceDb.close()
  }

  try {
    integrityCheck(temporaryPath)
    // Keep the previous database beside the restored one. This makes a
    // mistaken restore recoverable and also works on platforms where rename
    // cannot replace an existing file.
    const previousPath = `${destination}.before-restore-${randomUUID()}`
    if (existsSync(destination)) await rename(destination, previousPath)
    try {
      await rename(temporaryPath, destination)
    } catch (error) {
      if (existsSync(previousPath)) await rename(previousPath, destination).catch(() => undefined)
      throw error
    }
    // These sidecars belong to the old database and must not be replayed after
    // a restore. This is safe only because --force requires the app to be off.
    await rm(`${destination}-wal`, { force: true })
    await rm(`${destination}-shm`, { force: true })
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }

  console.log(`[restore] restored and verified ${sourcePath} -> ${destination}`)
}

main().catch(error => {
  console.error('[restore] fatal:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
