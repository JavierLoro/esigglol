import { env } from 'cloudflare:workers'
import { SignJWT, jwtVerify } from 'jose'

// Probe-specific credentials, never an application session or production secret.
export const COOKIE = 'feasibility_session'
function secret() {
  if (!env.PROBE_SECRET || env.PROBE_SECRET.length < 32) throw new Error('PROBE_SECRET must contain at least 32 characters')
  return new TextEncoder().encode(env.PROBE_SECRET)
}
export function signProbeSession() {
  return new SignJWT({ role: 'probe' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(secret())
}
export async function verifyProbeSession(token) {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.role === 'probe'
  } catch { return false }
}
