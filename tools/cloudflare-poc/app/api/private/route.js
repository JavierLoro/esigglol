import { cookies } from 'next/headers'
import { COOKIE, verifyProbeSession } from '../../../lib/session'

export async function GET() {
  const token = (await cookies()).get(COOKIE)?.value ?? ''
  if (!await verifyProbeSession(token)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({ role: 'probe' })
}
