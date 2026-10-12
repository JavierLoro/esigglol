import { getUploadFilename } from '../lib/upload-files'
import { getRuntime } from './context'
import { isReferenced } from './file-store'
import { scheduleWork } from './schedule'

// Claim deletion synchronously; an alarm can resume it after eviction/failure.
export function removeUnusedLogo(logo: string): void {
  const name = getUploadFilename(logo)
  if (!name) return
  const { database, state } = getRuntime()
  database.transaction(() => {
    if (isReferenced(name)) return
    database.prepare("INSERT INTO cloudflare_files (name,state) VALUES (?, 'deleting') ON CONFLICT(name) DO UPDATE SET state='deleting'").run(name)
    state.waitUntil(scheduleWork())
  }).immediate()
}
