import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getLobbyEvents } from '@/lib/tournament'

export async function GET(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Parametro code requerido' }, { status: 400 })

  try {
    const events = await getLobbyEvents(code)
    return NextResponse.json(events)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
