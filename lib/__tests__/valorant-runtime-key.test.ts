import { afterEach, expect, it, vi } from 'vitest'
import { getValorantRuntimeKey, setValorantSandboxKey } from '../valorant-runtime-key'
afterEach(() => {
  delete (globalThis as typeof globalThis & { valorantSandboxKey?: string }).valorantSandboxKey
  vi.unstubAllEnvs()
})
it('retains the sandbox key when Next restores the environment', async () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VALORANT_SANDBOX', '1'); vi.stubEnv('VALORANT_API_KEY', '')
  setValorantSandboxKey('test-only')
  process.env.VALORANT_API_KEY = ''
  vi.resetModules()
  const reloaded = await import('../valorant-runtime-key')
  expect(reloaded.getValorantRuntimeKey()).toBe('test-only')
})
it('never uses the sandbox key in production', () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VALORANT_SANDBOX', '1'); vi.stubEnv('VALORANT_API_KEY', '')
  setValorantSandboxKey('test-only')
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('VALORANT_API_KEY', 'production-only')
  expect(getValorantRuntimeKey()).toBe('production-only')
  expect(() => setValorantSandboxKey('blocked')).toThrow('Sandbox disabled')
})
