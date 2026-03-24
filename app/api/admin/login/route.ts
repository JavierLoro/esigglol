import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSession, COOKIE_NAME } from '@/lib/auth'
import { ADMIN_PASSWORD_HASH, IS_PRODUCTION } from '@/lib/env'

// Rate limiting: 5 intentos por IP cada 15 minutos
const attempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const now = Date.now()
  const record = attempts.get(ip)

  if (record) {
    if (now < record.resetAt) {
      if (record.count >= RATE_LIMIT_MAX) {
        return NextResponse.json({ error: 'Demasiados intentos. Inténtalo en 15 minutos.' }, { status: 429 })
      }
      record.count++
    } else {
      attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    }
  } else {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  }

  let body: { password?: string }
  try {
    body = await req.json() as { password?: string }
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.password || !(await bcrypt.compare(body.password, ADMIN_PASSWORD_HASH))) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  // Login exitoso: limpiar intentos
  attempts.delete(ip)

  const token = await createSession()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: 60 * 60 * 12, // 12 horas
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
