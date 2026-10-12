import { AsyncLocalStorage } from 'node:async_hooks'

export interface RuntimeServices {
  enqueueRefresh: (teamIds?: string[], summonerName?: string) => Promise<void>
  deferRiotRetry: boolean
  consumeLoginAttempt: (scope: string, ip: string, max: number) => boolean
  clearLoginAttempts: (scope: string, ip: string) => void
  adminPasswordHash: () => string | undefined
  deploymentInfo: () => Promise<Record<string, unknown>>
}

const services = new AsyncLocalStorage<RuntimeServices>()
export const runtimeServices = () => services.getStore()
export function withRuntimeServices<T>(value: RuntimeServices, action: () => T): T { return services.run(value, action) }
