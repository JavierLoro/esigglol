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

export async function GET(_req: Request, context: Context) {
  const deny = await requireAdminSession()
  if (deny) return deny
  const id = await teamId(context)
  if (!getTeamById(id)) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
  const access = getTeamAccessSecret(id)
  if (!access) return NextResponse.json({ configured: false })
  return NextResponse.json({ ...access, passwordHash: undefined, encryptedPassword: undefined, configured: true, password: decryptTeamPassword(access.encryptedPassword) })
}

export async function POST(_req: Request, context: Context) {
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

export async function PATCH(req: Request, context: Context) {
  const deny = await requireAdminSession()
  if (deny) return deny
  const id = await teamId(context)
  let body: { enabled?: unknown }
  try { body = await req.json() as { enabled?: unknown } } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'Estado inválido' }, { status: 422 })
  const info = setTeamAccessEnabled(id, body.enabled)
  return info ? NextResponse.json(info) : NextResponse.json({ error: 'Acceso no configurado' }, { status: 404 })
}
