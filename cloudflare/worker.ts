import { DurableObject } from 'cloudflare:workers'
import application from 'vinext/server/app-router-entry'
import { runMigrations } from '../lib/db-migrations'
import { createDatabase } from './database'
import { withRuntime } from './context'
import { collectGarbage } from './file-store'
import { JOB_SCHEMA, processRefreshJobs } from './refresh'
import { scheduleWork } from './schedule'
import { LOGIN_SCHEMA } from './login-rate-limit'
import { SETUP_SCHEMA, setup } from './setup'
export { FileBudget } from './file-budget'

// One coordination boundary per independently deployed installation. Related
// tournaments share credentials, branding and atomic cross-table mutations.
export class EsiggApplication extends DurableObject<Env> {
  private readonly database

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.database = createDatabase(state.storage)
    this.database.exec(`CREATE TABLE IF NOT EXISTS cloudflare_files (name TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('staging','live','deleting','deleted')), created_at INTEGER NOT NULL DEFAULT 0)`)
    runMigrations(this.database)
    this.database.exec(JOB_SCHEMA)
    this.database.exec(LOGIN_SCHEMA)
    this.database.exec(SETUP_SCHEMA)
    this.database.exec(`CREATE TABLE IF NOT EXISTS cloudflare_http_metrics (
      method TEXT NOT NULL, route TEXT NOT NULL, status TEXT NOT NULL, count INTEGER NOT NULL, seconds REAL NOT NULL,
      PRIMARY KEY(method, route, status))`)
    this.database.prepare('INSERT OR IGNORE INTO tournament_config(key,data) VALUES(?,?)').run('site-branding', JSON.stringify({ title: 'ESIgg Esports', subtitle: 'Torneos de League of Legends y Valorant', logo: '/logo-torneo.png', channel: '' }))
  }

  async fetch(request: Request): Promise<Response> {
    return withRuntime({ database: this.database, state: this.ctx, env: this.env }, () => {
      if (new URL(request.url).pathname === '/__setup') return setup(request)
      return application.fetch(request, this.env, this.ctx)
    })
  }

  async alarm(): Promise<void> {
    return withRuntime({ database: this.database, state: this.ctx, env: this.env }, async () => {
      try { await processRefreshJobs(); await collectGarbage() } finally {
        if (this.database.prepare("SELECT 1 FROM cloudflare_files WHERE state='deleting' LIMIT 1").get()) await scheduleWork(Date.now() + 60000)
      }
    })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only the routing hop executes under the ordinary Free Worker CPU budget.
    return env.APPLICATION.getByName(env.INSTALLATION_ID).fetch(request)
  },
} satisfies ExportedHandler<Env>
