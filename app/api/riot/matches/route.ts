import { NextRequest, NextResponse } from 'next/server'
import { getMatchDetails } from '@/lib/riot'

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get('id')
  if (!matchId) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  try {
    const match = await getMatchDetails(matchId)
    const res = NextResponse.json(match)
    res.headers.set('Cache-Control', 'public, max-age=600')
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
