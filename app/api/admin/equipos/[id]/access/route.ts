import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdminSession } from '@/lib/auth'
import { getTeamById } from '@/lib/data'
import { createTeamAccess, getTeamAccessSecret, replaceTeamAccess, setTeamAccessEnabled } from '@/lib/team-portal-data'
import { decryptTeamPassword, encryptTeamPassword, generateTeamPassword } from '@/lib/team-credentials'

type Context = { params: Promise<{ id: string }> }

async function teamId(context: Context): Promise<string> {
  return (await context.params).id
}

async function handleGET(_req: Request, context: Context) {
  const deny = await requireAdminSession()
  if (deny) return deny
  const id = await teamId(context)
  if (!getTeamById(id)) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
  const access = getTeamAccessSecret(id)
  if (!access) return NextResponse.json({ configured: false })
  return NextResponse.json({ ...access, passwordHash: undefined, encryptedPassword: undefined, configured: true, password: decryptTeamPassword(access.encryptedPassword) })
}

async function handlePOST(_req: Request, context: Context) {
  const deny = await requireAdminSession()
  if (deny) return deny
  const id = await teamId(context)
  if (!getTeamById(id)) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
  const password = generateTeamPassword()
  const hash = await bcrypt.hash(password, 12)
  const current = getTeamAccessSecret(id)
  const info = current
    ? replaceTeamAccess(id, hash, encryptTeamPassword(password))
    : createTeamAccess(id, hash, encryptTeamPassword(password))
  return NextResponse.json({ ...info, configured: true, password })
}

async function handlePATCH(req: Request, context: Context) {
  const deny = await requireAdminSession()
  if (deny) return deny
  const id = await teamId(context)
  let body: { enabled?: unknown }
  try { body = await req.json() as { enabled?: unknown } } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'Estado inválido' }, { status: 422 })
  if (!getTeamById(id)) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
  const info = setTeamAccessEnabled(id, body.enabled)
  return info ? NextResponse.json(info) : NextResponse.json({ error: 'Acceso no configurado' }, { status: 404 })
}

export const GET = competitionRoute(handleGET, 'admin')

export const POST = competitionRoute(handlePOST, 'admin')

export const PATCH = competitionRoute(handlePATCH, 'admin')
