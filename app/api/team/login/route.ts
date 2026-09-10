import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createTeamSession, TEAM_COOKIE_NAME } from '@/lib/auth'
import { IS_PRODUCTION } from '@/lib/env'
import { TeamLoginSchema } from '@/lib/schemas'
import { getTeamById } from '@/lib/data'
import { getTeamAccessSecret, markTeamLogin } from '@/lib/team-portal-data'

const attempts = new Map<string, { count: number; resetAt: number }>()

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const now = Date.now()
  const record = attempts.get(ip)
  if (record && record.resetAt > now && record.count >= 8) return NextResponse.json({ error: 'Demasiados intentos. Inténtalo más tarde.' }, { status: 429 })
  attempts.set(ip, record && record.resetAt > now ? { ...record, count: record.count + 1 } : { count: 1, resetAt: now + 15 * 60 * 1000 })

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = TeamLoginSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 422 })
  const access = getTeamAccessSecret(parsed.data.teamId)
  if (!access?.enabled || !(await bcrypt.compare(parsed.data.password, access.passwordHash))) {
    return NextResponse.json({ error: 'Equipo o contraseña incorrectos' }, { status: 401 })
  }
  attempts.delete(ip)
  markTeamLogin(parsed.data.teamId)
  const response = NextResponse.json({ ok: true, team: getTeamById(parsed.data.teamId) })
  response.cookies.set(TEAM_COOKIE_NAME, await createTeamSession(parsed.data.teamId, access.sessionVersion), {
    httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', maxAge: 60 * 60 * 12, path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(TEAM_COOKIE_NAME)
  return response
}
