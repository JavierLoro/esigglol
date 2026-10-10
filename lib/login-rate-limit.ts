import { runtimeServices } from './runtime-services'

const attempts = new Map<string, { count: number; resetAt: number }>()
export function loginIp(request: Request): string {
  return (runtimeServices() ? request.headers.get('cf-connecting-ip') : request.headers.get('x-forwarded-for')?.split(',')[0])?.trim().slice(0, 64) || 'unknown'
}
export function consumeLoginAttempt(scope: string, ip: string, max: number): boolean {
  const runtime = runtimeServices()
  if (runtime) return runtime.consumeLoginAttempt(scope, ip, max)
  const key = `${scope}:${ip}`
  const now = Date.now()
  const previous = attempts.get(key)
  const record = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + 900000 }
  if (record.count >= max) return false
  record.count++
  attempts.set(key, record)
  return true
}
export function clearLoginAttempts(scope: string, ip: string): void {
  const runtime = runtimeServices()
  if (runtime) runtime.clearLoginAttempts(scope, ip)
  else attempts.delete(`${scope}:${ip}`)
}
