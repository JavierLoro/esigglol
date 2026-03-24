import { NextRequest, NextResponse } from 'next/server'
import { getTeams, saveTeams, generateId } from '@/lib/data'
import { requireAdminSession } from '@/lib/auth'
import { TeamSchema, TeamUpdateSchema, DeleteIdSchema } from '@/lib/schemas'
import type { Team } from '@/lib/types'

export async function GET() {
  const deny = await requireAdminSession()
  if (deny) return deny
  return NextResponse.json(getTeams())
}

export async function POST(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = TeamSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const teams = getTeams()
  const team: Team = { id: generateId('team'), ...parsed.data }
  teams.push(team)
  saveTeams(teams)
  return NextResponse.json(team, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = TeamUpdateSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const teams = getTeams()
  const idx = teams.findIndex(t => t.id === parsed.data.id)
  if (idx === -1) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  teams[idx] = parsed.data as Team
  saveTeams(teams)
  return NextResponse.json(parsed.data)
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = DeleteIdSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const teams = getTeams().filter(t => t.id !== parsed.data.id)
  saveTeams(teams)
  return NextResponse.json({ ok: true })
}
