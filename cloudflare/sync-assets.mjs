import { spawnSync } from 'node:child_process'

// Public asset synchronization never needs installation credentials.
const env = { ...process.env, SESSION_SECRET: 'public-assets-build-placeholder-32-characters', ADMIN_PASSWORD_HASH: 'public-assets-build-placeholder' }
for (const script of [['scripts/sync-ddragon.ts'], ['scripts/sync-valorant.ts', '--optional']]) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', ...script], { env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
