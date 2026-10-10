import db from '@/lib/db'
import { inTournament } from '@/lib/competition-context'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createTeamSession, TEAM_COOKIE_NAME } from '@/lib/auth'
import { IS_PRODUCTION } from '@/lib/env'
import { TeamLoginSchema } from '@/lib/schemas'
import { getTeamById } from '@/lib/data'
import { getTeamAccessSecret, markTeamLogin } from '@/lib/team-portal-data'

import { loginIp, consumeLoginAttempt, clearLoginAttempts } from '@/lib/login-rate-limit'

export async function POST(req: NextRequest) {
  const ip = loginIp(req)
  if (!consumeLoginAttempt('team', ip, 8)) return NextResponse.json({ error: 'Demasiados intentos. Inténtalo más tarde.' }, { status: 429 })

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = TeamLoginSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 422 })
  const access = getTeamAccessSecret(parsed.data.teamId)
  if (!access?.enabled || !(await bcrypt.compare(parsed.data.password, access.passwordHash))) {
    return NextResponse.json({ error: 'Equipo o contraseña incorrectos' }, { status: 401 })
  }
  clearLoginAttempts('team', ip)
  markTeamLogin(parsed.data.teamId)
  const row = db.prepare('SELECT data FROM teams WHERE id = ?').get(parsed.data.teamId) as { data: string } | undefined
  const team = row ? inTournament(JSON.parse(row.data).tournamentId, () => getTeamById(parsed.data.teamId)) : undefined
  const response = NextResponse.json({ ok: true, team })
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
