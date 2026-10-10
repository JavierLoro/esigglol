import { env } from 'cloudflare:workers'
import { cookies } from 'next/headers'
import { after, NextResponse } from 'next/server'
import { COOKIE, signProbeSession } from '../../../lib/session'
import { pilotFiles, withR2Budget } from '../../../lib/r2-budget.mjs'

export function GET() {
  return Response.json({ scope: 'isolated-fixture', d1: Boolean(env.DB), r2: Boolean(env.FILES) })
}

export async function POST() {
  return withR2Budget(async () => {
    const files = pilotFiles(env)
    // Reserve before responding, so an exhausted background write returns 429.
    const complete = files ? (env.PROBE_REMOTE === '1'
      ? await files.preparePut('probe-after.txt', 'completed')
      : () => files.put('probe-after.txt', 'completed')) : undefined
    if (files) await files.delete('probe-after.txt')
    const token = await signProbeSession()
    const cookieStore = await cookies()
    cookieStore.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300, secure: env.PROBE_REMOTE === '1' })
    if (complete) after(async () => {
      // A bounded diagnostic side effect, not a reliable background job.
      await complete()
    })
    return NextResponse.json({ signed: true })
  })
}
