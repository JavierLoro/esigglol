import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSession, COOKIE_NAME } from '@/lib/auth'
import { ADMIN_PASSWORD_HASH, IS_PRODUCTION } from '@/lib/env'

import { loginIp, consumeLoginAttempt, clearLoginAttempts } from '@/lib/login-rate-limit'
import { runtimeServices } from '@/lib/runtime-services'

export async function POST(req: NextRequest) {
  const ip = loginIp(req)
  if (!consumeLoginAttempt('admin', ip, 5)) return NextResponse.json({ error: 'Demasiados intentos. Inténtalo en 15 minutos.' }, { status: 429 })

  let body: { password?: string }
  try {
    body = await req.json() as { password?: string }
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body?.password !== 'string' || !body.password || body.password.length > 200 || !(await bcrypt.compare(body.password, runtimeServices()?.adminPasswordHash() ?? ADMIN_PASSWORD_HASH))) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  // Login exitoso: limpiar intentos
  clearLoginAttempts('admin', ip)

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
