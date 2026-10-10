import assert from 'node:assert/strict'
import { test } from 'node:test'
import { protectWorker } from '../remote/guard.mjs'

const token = 'test-only-credential-with-at-least-32-characters'
const env = { PROBE_ACCESS_TOKEN: token, PROBE_EXPIRES_AT: '2099-01-01T00:00:00Z', DB: { prepare() { return { async first() { return { requests: 1 } } } } } }

test('remote guard denies every diagnostic and asset path before dispatch', async () => {
  let calls = 0
  const guarded = protectWorker({ fetch() { calls++; return new Response('unexpected') } })
  for (const pathname of ['/', '/probe.svg', '/api/probe', '/api/storage', '/api/private', '/api/after']) {
    for (const authorization of ['', 'Bearer invalid', `Basic ${token}`]) {
      const response = await guarded.fetch(new Request(`https://pilot.test${pathname}`, { headers: { Authorization: authorization } }), env, {})
      assert.equal(response.status, 401)
    }
  }
  assert.equal(calls, 0)
})

test('remote guard fails closed without a credential or after expiration', async () => {
  const guarded = protectWorker({ fetch() { throw new Error('must not dispatch') } })
  for (const invalid of [{}, { ...env, PROBE_ACCESS_TOKEN: 'short' }, { ...env, PROBE_EXPIRES_AT: 'invalid' }, { ...env, PROBE_EXPIRES_AT: '2000-01-01T00:00:00Z' }]) {
    assert.equal((await guarded.fetch(new Request('https://pilot.test/'), invalid, {})).status, 503)
  }
})

test('authorized requests lose the credential before rendering and are not cached', async () => {
  const guarded = protectWorker({ fetch(request) {
    assert.equal(request.headers.has('Authorization'), false)
    return new Response('rendered', { headers: { 'Set-Cookie': 'session=example; HttpOnly', 'Cache-Control': 'public' } })
  } })
  const response = await guarded.fetch(new Request('https://pilot.test/', { headers: { Authorization: `Bearer ${token}` } }), env, {})
  assert.equal(await response.text(), 'rendered')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('Set-Cookie'), 'session=example; HttpOnly')
})

test('quota exhaustion and a database failure never dispatch the fixture', async () => {
  const guarded = protectWorker({ fetch() { throw new Error('must not dispatch') } })
  const request = () => new Request('https://pilot.test/', { headers: { Authorization: `Bearer ${token}` } })
  assert.equal((await guarded.fetch(request(), { ...env, DB: { prepare() { return { async first() { return null } } } } }, {})).status, 429)
  assert.equal((await guarded.fetch(request(), { ...env, DB: undefined }, {})).status, 503)
})
