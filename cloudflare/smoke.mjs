import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { readStaticAssets } from './asset-manifest.mjs'
import { verifyFrontend } from './frontend-check.mjs'

const directory = path.resolve('dist/server')
function modules(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(prefix, entry.name)
    return entry.isDirectory() ? modules(path.join(dir, entry.name), name) : /\.m?js$/.test(name) ? [{ type: 'ESModule', path: name, contents: readFileSync(path.join(dir, entry.name), 'utf8') }] : []
  })
}
const persistence = mkdtempSync(path.join(os.tmpdir(), 'esigglol-cloudflare-'))
const configuration = {
  name: 'esigglol-smoke',
  modulesRoot: directory,
  modules: modules(directory).sort((a, b) => a.path === 'index.mjs' ? -1 : b.path === 'index.mjs' ? 1 : a.path.localeCompare(b.path)).map(module => ({ ...module, path: path.join(directory, module.path) })),
  compatibilityDate: '2026-10-10', compatibilityFlags: ['nodejs_compat'],
  durableObjects: { APPLICATION: { className: 'EsiggApplication', useSQLite: true }, FILE_BUDGET: { className: 'FileBudget', useSQLite: true } },
  durableObjectsPersist: persistence,
  r2Buckets: { FILES: 'application-smoke-files' }, r2Persist: path.join(persistence, 'r2'),
  assets: { directory: path.resolve('dist/client'), binding: 'ASSETS' },
  outboundService: () => new Response('{}', { status: 429, headers: { 'Retry-After': '3600' } }),
  bindings: { NODE_ENV: 'production', IS_CLOUDFLARE: '1', INSTALLATION_ID: 'smoke', SESSION_SECRET: 'isolated-smoke-test-session-secret-32-characters', ADMIN_PASSWORD_HASH: await bcrypt.hash('fallback-smoke-password', 4), BOOTSTRAP_TOKEN: 'a'.repeat(43), BOOTSTRAP_EXPIRES: new Date(Date.now() + 3600000).toISOString() },
}
let runtime
let checks = 0
function start() {
  const options = convertV4MiniflareOptions(configuration)
  options.isolatedResourcePersistencePath = persistence
  options.resourcePersistencePath = persistence
  options.workers[0].config.assets.hasUserWorker = true
  return new Miniflare(options)
}
async function request(url, status, init = {}) {
  const native = new Request(new URL(url, 'https://app.test'), { redirect: 'manual', ...init })
  const response = await runtime.dispatchFetch(native.url, { method: native.method, headers: native.headers, redirect: 'manual', ...(init.body ? { body: new Uint8Array(await native.arrayBuffer()) } : {}) })
  const content = await response.text()
  assert.equal(response.status, status, `${url}: ${content.slice(0, 800)}`)
  checks++
  return { response, content }
}
try {
  runtime = start()
  await request('/api/health', 200)
  await request('/', 200)
  const frontend = await verifyFrontend('https://app.test', {
    manifest: readStaticAssets().manifest,
    request: (url, init) => runtime.dispatchFetch(url, init),
  })
  console.log(`Cloudflare frontend: ${frontend.pages} pages and ${frontend.assets} JavaScript/CSS assets verified`)
  const image = await request('/_next/image?url=%2Flogo-torneo.png&w=384&q=75', 302)
  await request(image.response.headers.get('location'), 200)
  await request('/api/metrics', 200)
  await request('/admin', 307)
  await request('/admin/login', 200)
  await request('/api/admin/torneos', 401)
  await request('/api/admin/runtime', 401)
  await request('/__setup', 403)
  const setup = await request(`/__setup?token=${'a'.repeat(43)}`, 200)
  assert.equal(setup.response.headers.get('referrer-policy'), 'strict-origin')
  await request(`/__setup?token=${'a'.repeat(43)}`, 403, { method: 'POST', body: 'password=smoke-password' })
  for (const origin of ['null', 'https://other.test']) await request(`/__setup?token=${'a'.repeat(43)}`, 403, { method: 'POST', headers: { origin }, body: 'password=smoke-password' })
  await request(`/__setup?token=${'a'.repeat(43)}`, 303, { method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=smoke-password' })
  await request(`/__setup?token=${'a'.repeat(43)}`, 403)
  const login = await request('/api/admin/login', 200, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.10' }, body: JSON.stringify({ password: 'smoke-password' }) })
  const cookie = login.response.headers.get('set-cookie').split(';')[0]
  const admin = (body, method = 'POST') => ({ method, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  await request('/admin', 200, { headers: { cookie } })
  const tournament = JSON.parse((await request('/api/admin/torneos', 200, admin({ name: 'HTTP smoke LoL', slug: 'smoke-lol', game: 'lol', platform: 'pc', region: 'eu', status: 'draft' }))).content)
  const valorant = JSON.parse((await request('/api/admin/torneos', 200, admin({ name: 'HTTP smoke Valorant', slug: 'smoke-valorant', game: 'valorant', platform: 'pc', region: 'eu', status: 'draft' }))).content)
  const selected = `?tournament=${tournament.id}`
  const team = JSON.parse((await request(`/api/admin/equipos${selected}`, 201, admin({ name: 'Test team', logo: '', players: [{ id: 'player-smoke', summonerName: 'Player#EUW', primaryRole: 'Top' }] }))).content)
  await request(`/api/data/equipos${selected}`, 404)
  await request('/api/admin/torneos', 200, admin({ ...tournament, status: 'published' }))
  assert.match((await request(`/api/data/equipos${selected}`, 200)).content, /Test team/)
  const access = JSON.parse((await request(`/api/admin/equipos/${team.id}/access${selected}`, 200, { headers: { cookie } })).content)
  const teamLogin = await request('/api/team/login', 200, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: team.id, password: access.password }) })
  const teamCookie = teamLogin.response.headers.get('set-cookie').split(';')[0]
  await request('/equipo', 200, { headers: { cookie: teamCookie } })
  const deployment = JSON.parse((await request('/api/admin/runtime', 200, { headers: { cookie } })).content)
  assert.equal(deployment.storage, 'durable-object-sqlite')
  assert.equal(deployment.fileUsage.class_a, 0)
  const logo = new FormData()
  logo.set('teamId', team.id)
  logo.set('file', new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'], { type: 'image/svg+xml' }), 'test.svg')
  const upload = JSON.parse((await request(`/api/admin/equipos/upload-logo${selected}`, 200, { method: 'POST', headers: { cookie }, body: logo })).content)
  await request(upload.path, 200)
  const secondTeam = JSON.parse((await request(`/api/admin/equipos${selected}`, 201, admin({ name: 'Second team', logo: '', players: [] }))).content)
  const phase = JSON.parse((await request(`/api/admin/fases${selected}`, 201, admin({ name: 'Final', type: 'elimination', status: 'upcoming', order: 1, config: { bo: 1, bracketTeamIds: [team.id, secondTeam.id] } }))).content)
  await request(`/api/admin/fases/generate${selected}`, 200, admin({ phaseId: phase.id }))
  await request(`/fases${selected}`, 200)
  await request(`/partidos${selected}`, 200)
  await request(`/api/riot/refresh-stats${selected}`, 200, admin({}))
  assert.equal(JSON.parse((await request(`/api/riot/refresh-stats${selected}`, 200, { headers: { cookie } })).content).running, true)
  await request(`/ranking?tournament=${valorant.id}`, 200, { headers: { cookie } })
  for (let i = 0; i < 5; i++) await request('/api/admin/login', 401, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.20' }, body: JSON.stringify({ password: 'wrong' }) })
  await request('/api/admin/login', 429, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.20' }, body: JSON.stringify({ password: 'wrong' }) })
  await runtime.dispose()
  runtime = start()
  await request('/admin', 200, { headers: { cookie } })
  assert.match((await request(`/api/data/equipos${selected}`, 200)).content, /Test team/)
  await request(upload.path, 200)
  await request('/equipo', 200, { headers: { cookie: teamCookie } })
  await request('/api/admin/login', 429, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.20' }, body: JSON.stringify({ password: 'wrong' }) })
  console.log(`${checks} Cloudflare application HTTP checks passed, including restart persistence`)
} finally {
  await runtime?.dispose()
  rmSync(persistence, { recursive: true, force: true })
}
