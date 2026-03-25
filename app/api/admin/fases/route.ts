import { NextRequest, NextResponse } from 'next/server'
import { getPhases, savePhases, generateId } from '@/lib/data'
import { requireAdminSession } from '@/lib/auth'
import { PhaseSchema, PhaseUpdateSchema, DeleteIdSchema } from '@/lib/schemas'
import type { Phase } from '@/lib/types'
import logger from '@/lib/logger'

const log = logger.child({ module: 'fases' })

export async function GET() {
  const deny = await requireAdminSession()
  if (deny) return deny
  return NextResponse.json(getPhases())
}

export async function POST(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = PhaseSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const phases = getPhases()
  const phase: Phase = { id: generateId('phase'), ...parsed.data }
  phases.push(phase)
  try { savePhases(phases) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json(phase, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = PhaseUpdateSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const phases = getPhases()
  const idx = phases.findIndex(p => p.id === parsed.data.id)
  if (idx === -1) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  phases[idx] = parsed.data as Phase
  try { savePhases(phases) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json(parsed.data)
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = DeleteIdSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const phases = getPhases().filter(p => p.id !== parsed.data.id)
  try { savePhases(phases) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
