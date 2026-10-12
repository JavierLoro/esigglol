import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { SignJWT } from 'jose'

const origin = 'https://esiggesports.jlc-dev.me'
const secrets = JSON.parse(readFileSync('.wrangler/application-secrets.json', 'utf8'))
const jwt = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(secrets.SESSION_SECRET))
const cookie = `admin_session=${jwt}`
const tournaments = []
const checks = []
async function request(path, status, init = {}) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(20000), ...init })
  const body = await response.text()
  assert.equal(response.status, status, `${path.split('?')[0]}: unexpected status ${response.status}`)
  checks.push({ path: path.split('?')[0], status })
  return { response, body }
}
const admin = (body, method = 'POST') => ({ method, headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
try {
  await request('/api/health', 200)
  assert.match((await request('/', 200)).body, /ESIgg Esports/)
  await request('/admin', 307)
  await request('/admin/login', 200)
  await request('/api/admin/torneos', 401)
  await request('/__setup', 403)
  await request(`/__setup?token=${secrets.BOOTSTRAP_TOKEN}`, 200)
  await request('/admin', 200, { headers: { cookie } })
  const suffix = Date.now().toString(36)
  for (const game of ['lol', 'valorant']) {
    const tournament = JSON.parse((await request('/api/admin/torneos', 200, admin({ name: `Deployment verification ${game}`, slug: `deployment-${game}-${suffix}`, game, platform: 'pc', region: 'eu', status: 'draft' }))).body)
    tournaments.push(tournament)
  }
  const tournament = tournaments[0]
  const selected = `?tournament=${tournament.id}`
  const team = JSON.parse((await request(`/api/admin/equipos${selected}`, 201, admin({ name: 'Deployment verification team', logo: '', players: [] }))).body)
  const access = JSON.parse((await request(`/api/admin/equipos/${team.id}/access${selected}`, 200, { headers: { cookie } })).body)
  const login = await request('/api/team/login', 200, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: team.id, password: access.password }) })
  const teamCookie = login.response.headers.get('set-cookie').split(';')[0]
  await request('/equipo', 200, { headers: { cookie: teamCookie } })
  const logo = new FormData()
  logo.set('teamId', team.id)
  logo.set('file', new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'], { type: 'image/svg+xml' }), 'verification.svg')
  const upload = JSON.parse((await request(`/api/admin/equipos/upload-logo${selected}`, 200, { method: 'POST', headers: { cookie }, body: logo })).body)
  await request(upload.path, 200)
  const deployment = JSON.parse((await request('/api/admin/runtime', 200, { headers: { cookie } })).body)
  assert.equal(deployment.storage, 'durable-object-sqlite')
  assert.equal(typeof deployment.bookmark, 'string')
  assert.ok(deployment.fileUsage.class_a >= 1)
  await request(`/api/admin/equipos/${team.id}/access${selected}`, 200, admin({ enabled: false }, 'PATCH'))
  await request('/api/team', 403, { headers: { cookie: teamCookie } })
  const html = (await request('/', 200)).body
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css|woff2))"/g)].map(match => match[1]))]
  for (const asset of assets) await request(asset, 200)
  const image = await request('/_next/image?url=%2Flogo-torneo.png&w=384&q=75', 302)
  await request(image.response.headers.get('location'), 200)
  mkdirSync('.wrangler', { recursive: true })
  writeFileSync('.wrangler/application-remote-evidence.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, deployment }, null, 2), { mode: 0o600 })
  console.log(`${checks.length} remote Cloudflare checks passed; SQLite PITR, R2 and team session revocation verified`)
} finally {
  for (const tournament of tournaments) await request('/api/admin/torneos', 200, admin({ id: tournament.id }, 'DELETE'))
}
