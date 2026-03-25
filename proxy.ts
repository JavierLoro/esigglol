import { NextRequest, NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'
import { IS_PRODUCTION } from '@/lib/env'
import { httpRequestDuration, httpRequestsTotal } from '@/lib/metrics'
import logger from '@/lib/logger'

const log = logger.child({ module: 'http' })
const isProd = IS_PRODUCTION

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://embed.twitch.tv",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://ddragon.leagueoflegends.com",
  "font-src 'self'",
  "connect-src 'self' https://ddragon.leagueoflegends.com",
  "frame-src https://player.twitch.tv https://embed.twitch.tv",
  "frame-ancestors 'none'",
].join('; ')

function normalizeRoute(pathname: string): string {
  // Collapse dynamic segments for grouping: /equipos/team-abc-123 → /equipos/:id
  return pathname
    .replace(/\/[a-z]+-\d{13}-[a-z0-9]+/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
}

export async function proxy(req: NextRequest) {
  const start = performance.now()
  const { pathname } = req.nextUrl
  const method = req.method
  const route = normalizeRoute(pathname)

  // Proteger todas las rutas /admin excepto /admin/login
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token || !(await verifySession(token))) {
      const duration = (performance.now() - start) / 1000
      httpRequestDuration.observe({ method, route, status_code: '302' }, duration)
      httpRequestsTotal.inc({ method, route, status_code: '302' })
      log.info({ method, route, status: 302, duration_ms: Math.round(duration * 1000) }, 'redirect to login')
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }

  const res = NextResponse.next()

  // Cabeceras de seguridad (aplican a todas las rutas)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isProd) {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  }
  // CSRF: no se usan tokens dedicados. La proteccion viene de SameSite=lax en cookies,
  // Content-Type: application/json en todas las API mutations, y verificacion JWT en admin.

  const duration = (performance.now() - start) / 1000
  httpRequestDuration.observe({ method, route, status_code: '200' }, duration)
  httpRequestsTotal.inc({ method, route, status_code: '200' })
  log.info({ method, route, status: 200, duration_ms: Math.round(duration * 1000) }, 'request')

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ddragon/).*)'],
}
