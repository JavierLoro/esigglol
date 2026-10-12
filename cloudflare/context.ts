import { AsyncLocalStorage } from 'node:async_hooks'
import type { DatabaseContract } from '../lib/database-contract'
import { withRuntimeServices } from '../lib/runtime-services'
import { enqueueRefresh } from './refresh'
import { consumeLoginAttempt, clearLoginAttempts } from './login-rate-limit'

export interface RuntimeContext {
  database: DatabaseContract
  state: DurableObjectState
  env: Env
}

const runtime = new AsyncLocalStorage<RuntimeContext>()
export function withRuntime<T>(context: RuntimeContext, callback: () => T): T {
  return runtime.run(context, () => withRuntimeServices({ enqueueRefresh, deferRiotRetry: true, consumeLoginAttempt, clearLoginAttempts,
    adminPasswordHash: () => (context.database.prepare('SELECT hash FROM cloudflare_admin_config WHERE id=1').get() as { hash: string } | undefined)?.hash,
    deploymentInfo: async () => ({ runtime: 'cloudflare', storage: 'durable-object-sqlite',
      databaseBytes: context.state.storage.sql.databaseSize,
      fileUsage: await context.env.FILE_BUDGET.getByName('esigglol-application').usage(),
      bookmark: await context.state.storage.getCurrentBookmark().catch(() => null),
      refreshJobs: context.database.prepare('SELECT tournament_id,cursor,stage,running,key_expired,attempts,due FROM cloudflare_refresh_jobs ORDER BY due LIMIT 100').all(),
    }),
  }, callback))
}
export function getRuntime(): RuntimeContext {
  const context = runtime.getStore()
  if (!context) throw new Error('Cloudflare runtime context unavailable')
  return context
}
