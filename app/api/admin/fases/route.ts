import { NextRequest, NextResponse } from 'next/server'
import { createPhase, deletePhase, generateId, getMatches, getPhases, StaleWriteError, updatePhase } from '@/lib/data'
import { requireAdminSession } from '@/lib/auth'
import { PhaseSchema, PhaseUpdateSchema, DeleteIdSchema } from '@/lib/schemas'
import type { Phase } from '@/lib/types'
import logger from '@/lib/logger'
import { getSwissConfirmationError } from '@/lib/swiss'
import { changedStructuralPhaseFields } from '@/lib/phase-structure'

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

  const phase: Phase = { id: generateId('phase'), ...parsed.data }
  try { return NextResponse.json(createPhase(phase), { status: 201 }) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
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

  const phaseMatches = getMatches().filter(match => match.phaseId === parsed.data.id)
  const structuralChanges = changedStructuralPhaseFields(phases[idx], parsed.data as Phase)
  if (phaseMatches.length > 0 && structuralChanges.length > 0) {
    return NextResponse.json({
      error: 'No se puede cambiar la estructura de una fase que ya tiene partidos',
      fields: structuralChanges,
    }, { status: 409 })
  }
  if (parsed.data.type === 'swiss') {
    const confirmationError = getSwissConfirmationError(
      phaseMatches,
      parsed.data.config.confirmedRounds ?? [],
    )
    if (confirmationError) return NextResponse.json({ error: confirmationError }, { status: 422 })
  }
  phases[idx] = parsed.data as Phase
  try { return NextResponse.json(updatePhase(parsed.data as Phase)) } catch (err) {
    if (err instanceof StaleWriteError) return NextResponse.json({ error: 'La fase cambió en otra sesión. Recarga antes de guardar.' }, { status: 409 })
    log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = DeleteIdSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  if (!getPhases().some(phase => phase.id === parsed.data.id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  try {
    if (!deletePhase(parsed.data.id, parsed.data.version)) return NextResponse.json({ error: 'La fase cambió en otra sesión. Recarga antes de eliminar.' }, { status: 409 })
  } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}
