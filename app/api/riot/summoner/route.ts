import { competitionRoute } from '@/lib/competition-route'
import { NextRequest, NextResponse } from 'next/server'
import { getPlayerStats } from '@/lib/riot'

async function handleGET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name requerido' }, { status: 400 })

  try {
    const stats = await getPlayerStats(name)
    const res = NextResponse.json(stats)
    res.headers.set('Cache-Control', 'public, max-age=600')
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = competitionRoute(handleGET, 'lol')
