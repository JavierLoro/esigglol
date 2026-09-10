import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_SECRET } from './env'

const SECRET = new TextEncoder().encode(SESSION_SECRET)
const COOKIE_NAME = 'admin_session'
const TEAM_COOKIE_NAME = 'team_session'

interface SessionPayload {
  role: 'admin' | 'team'
  teamId?: string
  sessionVersion?: number
}

export async function createSession(): Promise<string> {
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .setIssuedAt()
    .sign(SECRET)
  return token
}

export async function readSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (payload.role === 'admin') return { role: 'admin' }
    if (payload.role === 'team' && typeof payload.teamId === 'string' && typeof payload.sessionVersion === 'number') return { role: 'team', teamId: payload.teamId, sessionVersion: payload.sessionVersion }
    return null
  } catch {
    return null
  }
}

export async function verifySession(token: string): Promise<boolean> {
  return (await readSession(token))?.role === 'admin'
}

export async function createTeamSession(teamId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ role: 'team', teamId, sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .setIssuedAt()
    .sign(SECRET)
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

export async function getTeamSessionFromCookies(): Promise<{ teamId: string; sessionVersion: number } | null> {
  const token = (await cookies()).get(TEAM_COOKIE_NAME)?.value
  if (!token) return null
  const session = await readSession(token)
  return session?.role === 'team' && session.teamId && session.sessionVersion
    ? { teamId: session.teamId, sessionVersion: session.sessionVersion }
    : null
}

export async function requireTeamSession(): Promise<{ teamId: string } | NextResponse> {
  const session = await getTeamSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { getTeamAccessSecret } = await import('./team-portal-data')
  const access = getTeamAccessSecret(session.teamId)
  if (!access?.enabled || access.sessionVersion !== session.sessionVersion) return NextResponse.json({ error: 'Acceso desactivado' }, { status: 403 })
  return { teamId: session.teamId }
}

export { COOKIE_NAME, TEAM_COOKIE_NAME }
