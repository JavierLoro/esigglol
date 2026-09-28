import { NextRequest, NextResponse } from 'next/server'
import { competitionRoute } from '@/lib/competition-route'
import { getOverlayConfig, saveOverlayConfig } from '@/lib/overlay-data'
import { OverlayConfigSchema } from '@/lib/overlay'

export const GET = competitionRoute(async (_request: NextRequest) => {
  void _request
  return NextResponse.json(getOverlayConfig(), { headers: { 'Cache-Control': 'no-store' } })
})

export const PUT = competitionRoute(async (request: NextRequest) => {
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = OverlayConfigSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Configuración de emisión inválida' }, { status: 422 })
  const error = saveOverlayConfig(parsed.data)
  if (error) return NextResponse.json({ error }, { status: 422 })
  return NextResponse.json(parsed.data)
})
