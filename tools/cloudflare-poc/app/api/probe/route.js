import { env } from 'cloudflare:workers'
import { cookies } from 'next/headers'
import { after, NextResponse } from 'next/server'
import { COOKIE, signProbeSession } from '../../../lib/session'

export function GET() {
  return Response.json({ scope: 'isolated-fixture', d1: Boolean(env.DB), r2: Boolean(env.FILES) })
}

export async function POST() {
  await env.FILES.delete('probe-after.txt')
  const token = await signProbeSession()
  const cookieStore = await cookies()
  cookieStore.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300 })
  after(async () => {
    // A bounded diagnostic side effect, not a reliable background job.
    await env.FILES.put('probe-after.txt', 'completed')
  })
  return NextResponse.json({ signed: true })
}
