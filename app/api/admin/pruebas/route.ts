import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { ValorantClient } from '@/lib/valorant'
import { setValorantSandboxKey } from '@/lib/valorant-runtime-key'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.VALORANT_SANDBOX !== '1') return new NextResponse(null, { status: 404 })
  const denied = await requireAdminSession()
  if (denied) return denied
  // Next dev can normalize nextUrl to localhost when the browser uses 127.0.0.1.
  // Match the actual HTTP Host, retaining an exact same-origin check.
  const expectedOrigin = `${req.nextUrl.protocol}//${req.headers.get('host') ?? req.nextUrl.host}`
  if (req.headers.get('origin') !== expectedOrigin) return NextResponse.json({ error: 'El origen de la petición no coincide. Abre este formulario desde la misma dirección del entorno de pruebas.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!/^RGAPI-[a-zA-Z0-9-]{20,80}$/.test(key)) return NextResponse.json({ error: 'Introduce una clave de desarrollo válida.' }, { status: 422 })
  const client = new ValorantClient(key)
  const content = await client.content()
  const act = content.data?.acts.find(a => a.isActive && a.type === 'act')
  if (!act) return NextResponse.json({ error: `Contenido no disponible (${content.httpStatus ?? content.availability}).` }, { status: 422 })
  const ladder = await client.leaderboard(act.id)
  if (ladder.availability !== 'available') return NextResponse.json({ error: `Clasificación no disponible (${ladder.httpStatus ?? ladder.availability}).` }, { status: 422 })
  // Process memory only. Never persist or echo the key, even in the test database.
  setValorantSandboxKey(key)
  return NextResponse.json({ ready: true, act: act.name }, { headers: { 'Cache-Control': 'no-store' } })
}
