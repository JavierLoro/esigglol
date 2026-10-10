import bcrypt from 'bcryptjs'
import { getRuntime } from './context'

export const SETUP_SCHEMA = `CREATE TABLE IF NOT EXISTS cloudflare_admin_config (id INTEGER PRIMARY KEY CHECK(id=1), hash TEXT NOT NULL)`
const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" }
function page(content: string, status = 200) {
  return new Response(`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Activar administración · ESIgg</title><style>body{background:#10131a;color:#f4f4f4;font:18px system-ui;max-width:32rem;margin:10vh auto;padding:1.5rem}input,button{font:inherit;box-sizing:border-box;width:100%;padding:.8rem;margin:.5rem 0}button{background:#c89b3c;color:#10131a;border:0;cursor:pointer}</style>${content}</html>`, { status, headers })
}
export async function setup(request: Request): Promise<Response> {
  const { env, database } = getRuntime()
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!env.BOOTSTRAP_TOKEN || !/^[A-Za-z0-9_-]{43}$/.test(token) || token !== env.BOOTSTRAP_TOKEN || !env.BOOTSTRAP_EXPIRES || Date.now() >= Date.parse(env.BOOTSTRAP_EXPIRES) || database.prepare('SELECT 1 FROM cloudflare_admin_config WHERE id=1').get()) return page('<h1>Enlace no disponible</h1><p>El enlace ha caducado o la administración ya está activada.</p>', 403)
  if (request.method === 'GET') return page(`<h1>Activa tu administración</h1><p>Elige la contraseña del administrador global. Este enlace se inutiliza al guardarla.</p><form method="post"><label for="password">Contraseña (mínimo 12 caracteres)</label><input id="password" name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required><button>Guardar y entrar</button></form>`)
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })
  if (request.headers.get('origin') !== new URL(request.url).origin) return page('<p>Origen no válido.</p>', 403)
  const body = await request.text()
  if (body.length > 4096) return page('<p>Solicitud demasiado grande.</p>', 413)
  const password = new URLSearchParams(body).get('password') ?? ''
  if (password.length < 12 || password.length > 200 || new TextEncoder().encode(password).length > 72) return page('<p>Usa entre 12 y 72 bytes para la contraseña.</p>', 422)
  const hash = await bcrypt.hash(password, 12)
  // An overlapping POST can activate the installation only once.
  const inserted = database.prepare('INSERT OR IGNORE INTO cloudflare_admin_config(id,hash) VALUES(1,?)').run(hash)
  if (!inserted.changes) return page('<p>La administración ya está activada.</p>', 409)
  return new Response(null, { status: 303, headers: { Location: '/admin/login', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}
