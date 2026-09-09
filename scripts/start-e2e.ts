import { hashSync } from 'bcryptjs'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'

const { values } = parseArgs({ options: { port: { type: 'string', default: '3100' } } })
const dataDir = path.join(process.cwd(), '.tmp', 'e2e')

rmSync(dataDir, { recursive: true, force: true })

const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next')
const child = spawn(process.execPath, [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', values.port ?? '3100'], {
  env: {
    ...process.env,
    ADMIN_PASSWORD_HASH: hashSync('e2e-admin-password', 4),
    DB_PATH: path.join(dataDir, 'esigglol.db'),
    SESSION_SECRET: 'e2e-only-session-secret-that-is-never-used-outside-tests',
    TOURNAMENT_API_MODE: 'stub',
  },
  stdio: 'inherit',
})

child.on('exit', code => process.exit(code ?? 1))

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal))
}
