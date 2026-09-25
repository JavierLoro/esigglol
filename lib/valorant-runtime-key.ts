// Next dev can restore process.env while compiling a new route. Keep the
// sandbox credential in process-local memory across route module reloads.
const runtime = globalThis as typeof globalThis & { valorantSandboxKey?: string }
export function getValorantRuntimeKey(): string {
  if (process.env.NODE_ENV !== 'production' && process.env.VALORANT_SANDBOX === '1') {
    return runtime.valorantSandboxKey ?? process.env.VALORANT_API_KEY ?? ''
  }
  return process.env.VALORANT_API_KEY ?? ''
}
export function setValorantSandboxKey(key: string) {
  if (process.env.NODE_ENV === 'production' || process.env.VALORANT_SANDBOX !== '1') throw new Error('Sandbox disabled')
  runtime.valorantSandboxKey = key
  process.env.VALORANT_API_KEY = key
}
