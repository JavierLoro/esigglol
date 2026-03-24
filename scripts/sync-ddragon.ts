import { checkAndUpdate } from '../lib/ddragon'

checkAndUpdate().catch(err => {
  console.error('[DDragon] Sync failed:', err)
  process.exit(1)
})
