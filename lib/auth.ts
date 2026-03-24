import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_SECRET } from './env'

const SECRET = new TextEncoder().encode(SESSION_SECRET)
const COOKIE_NAME = 'admin_session'

export async function createSession(): Promise<string> {
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .setIssuedAt()
    .sign(SECRET)
  return token
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET)
    return true
  } catch {
    return false
  }
}

export async function getSessionFromCookies(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  return verifySession(token)
}

export async function requireAdminSession(): Promise<NextResponse | null> {
  const ok = await getSessionFromCookies()
  return ok ? null : NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

export { COOKIE_NAME }
