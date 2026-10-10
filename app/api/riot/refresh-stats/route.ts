import { competitionRoute } from '@/lib/competition-route'
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { runRefresh, getRefreshState } from '@/lib/refresh'
import { requireAdminSession } from '@/lib/auth'
import { runtimeServices } from '@/lib/runtime-services'

// GET: devuelve el estado actual (para polling desde el cliente)
async function handleGET(_request?: Request) {
  void _request
  return NextResponse.json(getRefreshState())
}

// POST: arranca la actualización en background y responde inmediatamente
async function handlePOST(req: Request) {
  const denied = await requireAdminSession()
  if (denied) return denied

  const state = getRefreshState()

  if (state.running) {
    return NextResponse.json({ status: 'running', message: 'Ya hay una actualización en curso' })
  }

  const body = await req.json().catch(() => ({})) as { teamIds?: string[] }
  const teamIds = Array.isArray(body.teamIds) ? body.teamIds : undefined

  const services = runtimeServices()
  if (services) await services.enqueueRefresh(teamIds)
  else after(async () => { await runRefresh(teamIds) })

  return NextResponse.json({ status: 'started' })
}

export const GET = competitionRoute(handleGET, 'lol')

export const POST = competitionRoute(handlePOST, 'lol')
