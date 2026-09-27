import { hashSync } from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { spawn } from 'node:child_process'
import riotIds from './fixtures/valorant-riot-ids.json'

async function main() {
  // This script always chooses its own database; it never imports the live DB.
  process.env.DB_PATH = path.join(process.cwd(), '.tmp', 'valorant-sandbox', 'sandbox.db')
  process.env.SESSION_SECRET = randomBytes(48).toString('hex')
  const password = 'valorant-pruebas-local'
  process.env.ADMIN_PASSWORD_HASH = hashSync(password, 10)
  process.env.VALORANT_SANDBOX = '1'
  process.env.VALORANT_API_KEY = ''
  process.env.RIOT_API_KEY = ''
  process.env.REFRESH_AUTO_INTERVAL_MS = '0'
  process.env.TOURNAMENT_API_MODE = 'stub'
  const { getTournaments, saveTournament } = await import('../lib/competitions')
  const { createTeam } = await import('../lib/data')
  const { inTournament } = await import('../lib/competition-context')
  const tournament = getTournaments(true).find(t => t.slug === 'valorant-ranking-pruebas') ?? saveTournament({ name: 'Valorant · Pruebas de ranking', slug: 'valorant-ranking-pruebas', game: 'valorant', platform: 'pc', region: 'eu', status: 'published' })
  const { getTeams } = await import('../lib/data')
  inTournament(tournament.id, () => {
    const existing = new Set(getTeams().map(t => t.id))
    for (let index = 0; index < 6; index++) {
      const id = `valorant-test-team-${index + 1}`
      if (existing.has(id)) continue
      createTeam({ id, name: `Pruebas ${index + 1}`, logo: '', players: riotIds.slice(index * 5, index * 5 + 5).map((summonerName, playerIndex) => ({ id: `valorant-test-player-${index * 5 + playerIndex + 1}`, summonerName, primaryRole: 'Flexible', rosterStatus: 'starter' })) })
    }
  })
  const db = (await import('../lib/db')).default
  db.close()
  console.log(`Entorno local: http://127.0.0.1:3200/admin/pruebas\nContraseña de pruebas: ${password}\nRanking: http://127.0.0.1:3200/ranking?tournament=${tournament.id}&game=valorant\n6 equipos, 30 Riot IDs. Base aislada: ${process.env.DB_PATH}`)
  const child = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3200'], {
    env: { ...process.env, ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH.replaceAll('$', '\\$'), NEXT_DIST_DIR: '.next-valorant-sandbox' }, stdio: 'inherit',
  })
  child.on('exit', code => process.exit(code ?? 1))
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal))
}
void main()
