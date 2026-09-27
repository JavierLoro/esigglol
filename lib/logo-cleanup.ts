import { unlinkSync } from 'node:fs'
import db from './db'
import { getUploadFilename, resolveUploadPath } from './upload-files'
import logger from './logger'

/** Remove an uploaded logo only when no team or pending request uses it. */
export function removeUnusedLogo(logo: string): void {
  const filename = getUploadFilename(logo)
  const path = filename ? resolveUploadPath(filename) : null
  if (!path) return

  // Keep the reference check and unlink under SQLite's writer lock.
  try {
    db.transaction(() => {
      const referenced = db.prepare(`
        SELECT 1 FROM teams WHERE json_extract(data, '$.logo') = ?
        UNION ALL
        SELECT 1 FROM team_change_requests
        WHERE status = 'pending' AND type = 'team_logo' AND json_extract(payload, '$.logo') = ?
        LIMIT 1
      `).get(logo, logo)
      if (referenced) return
      try { unlinkSync(path) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }).immediate()
  } catch (error) {
    logger.error({ err: error, filename }, 'Unable to clean up unused logo')
  }
}
