import { NextResponse } from 'next/server'
import { COOKIE, verifyProbeSession } from './lib/session'

// This tests the proxy convention; production proxy.ts remains unmodified.
export async function proxy(request) {
  if (['/api/private', '/api/storage'].includes(request.nextUrl.pathname)) {
    if (!await verifyProbeSession(request.cookies.get(COOKIE)?.value ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  const response = NextResponse.next()
  response.headers.set('X-Probe-Proxy', 'executed')
  response.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:")
  return response
}

export const config = { matcher: ['/', '/api/:path*'] }
