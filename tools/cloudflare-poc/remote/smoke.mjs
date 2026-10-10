import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

const base = process.env.PROBE_BASE_URL
const token = process.env.PROBE_ACCESS_TOKEN
if (!base || !token) throw new Error('PROBE_BASE_URL and PROBE_ACCESS_TOKEN are required')
const latencySamples = Number(process.env.PROBE_LATENCY_SAMPLES ?? 20)
if (!Number.isInteger(latencySamples) || latencySamples < 0 || latencySamples > 20) throw new Error('PROBE_LATENCY_SAMPLES must be between 0 and 20')
const target = new URL(base)
if (target.protocol !== 'https:' && target.hostname !== '127.0.0.1') throw new Error('Use HTTPS or the local loopback harness')
let requests = 0
let cookie = ''
const request = async (pathname, options = {}, authorized = true) => {
  if (++requests > 120) throw new Error('Pilot request budget exhausted')
  const headers = new Headers(options.headers)
  if (authorized) headers.set('Authorization', `Bearer ${token}`)
  if (cookie) headers.set('Cookie', cookie)
  return fetch(`${base}${pathname}`, { ...options, headers, redirect: 'manual', signal: AbortSignal.timeout(15000) })
}
for (const pathname of ['/', '/probe.svg', '/api/probe', '/api/storage', '/api/private', '/api/after', '/api/quota']) {
  assert.equal((await request(pathname, {}, false)).status, 401)
}
const home = await request('/')
assert.equal(home.status, 200)
const html = await home.text()
assert.match(html, /player#euw/)
assert.match(html, /valid-bracket/)
assert.equal(home.headers.get('x-probe-proxy'), 'executed')
assert.equal((await request('/probe.svg')).status, 200)
const bindings = await (await request('/api/probe')).json()
assert.equal(bindings.d1, true)
assert.equal((await request('/api/private')).status, 401)
const signed = await request('/api/probe', { method: 'POST' })
assert.equal(signed.status, 200)
const header = signed.headers.get('set-cookie')
assert.match(header, /HttpOnly/i)
assert.match(header, /Secure/i)
assert.match(header, /SameSite=Lax/i)
cookie = header.split(';')[0]
assert.deepEqual(await (await request('/api/private')).json(), { role: 'probe' })
const post = operation => request('/api/storage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation }) })
assert.equal((await post('reset')).status, 200)
assert.deepEqual(await (await post('rollback')).json(), { rolledBack: true })
const race = await Promise.all(Array.from({ length: 8 }, () => post('cas')))
assert.equal(race.filter(r => r.status === 200).length, 1)
assert.equal(race.filter(r => r.status === 409).length, 7)
if (!bindings.r2) {
  assert.equal((await post('write-file')).status, 503)
  assert.equal((await request('/api/storage')).status, 503)
  assert.equal((await request('/api/after')).status, 503)
} else {
  assert.equal((await post('write-file')).status, 200)
  const object = await request('/api/storage')
  assert.equal(object.status, 200)
  assert.match(object.headers.get('content-type'), /text\/plain/)
  assert.ok(object.headers.get('etag'))
  assert.equal(await object.text(), 'r2-round-trip')
  assert.equal((await post('delete-file')).status, 200)
  assert.equal((await request('/api/storage')).status, 404)
  let completed = false
  for (let attempt = 0; attempt < 10 && !completed; attempt++) {
    completed = (await (await request('/api/after')).json()).completed
    if (!completed) await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(completed, true)
  assert.equal((await post('delete-after')).status, 200)
  const quota = await (await request('/api/quota')).json()
  assert.equal(quota.scope, 'pilot-lifetime')
  assert.equal(quota.limits.classA, 100)
  assert.equal(quota.limits.classB, 1000)
  assert.ok(quota.used.classA >= 2)
  assert.ok(quota.used.classB >= 3)
}
const latency = {}
for (const [name, pathname] of [['ssr', '/'], ['json', '/api/probe'], ['jwt', '/api/private']]) {
  if (!latencySamples) continue
  const samples = []
  for (let i = 0; i < latencySamples; i++) {
    const start = performance.now()
    const response = await request(pathname)
    assert.equal(response.status, 200)
    await response.arrayBuffer()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  latency[name] = { requests: latencySamples, wallMsP50: samples[Math.ceil(latencySamples * 0.5) - 1], wallMsP95: samples[Math.ceil(latencySamples * 0.95) - 1] }
}
console.log(JSON.stringify({ base, requests, bindings, cas: { winners: 1, conflicts: 7 }, rollback: true, cpuMs: null, latency }, null, 2))
