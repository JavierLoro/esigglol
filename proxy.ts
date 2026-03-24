import { NextRequest, NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'
import { IS_PRODUCTION } from '@/lib/env'

const isProd = IS_PRODUCTION

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://ddragon.leagueoflegends.com",
  "font-src 'self'",
  "connect-src 'self' https://ddragon.leagueoflegends.com",
  "frame-src https://player.twitch.tv https://embed.twitch.tv",
  "frame-ancestors 'none'",
].join('; ')

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Proteger todas las rutas /admin excepto /admin/login
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token || !(await verifySession(token))) {
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

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ddragon/).*)'],
}
