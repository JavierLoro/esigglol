import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

// Exercise the upload artifact, not only the guard in isolation.
test('protected upload artifact: SSR, JWT, D1, R2 and concurrent quota ceiling', { timeout: 120000 }, async () => {
  execFileSync(process.execPath, ['remote/prepare.mjs'], {
    env: { ...process.env, PROBE_OUTPUT_DIR: '.wrangler/remote-test', PROBE_DATABASE_ID: '00000000-0000-0000-0000-000000000000' }, stdio: 'pipe',
  })
  const accessToken = randomBytes(32).toString('hex')
  const directory = path.resolve('.wrangler/remote-test')
  const files = readdirSync(directory, { recursive: true }).filter(name => /\.(?:m?js)$/.test(name)).sort()
  const modules = ['pilot.mjs', ...files.filter(name => name !== 'pilot.mjs')].map(name => ({ type: 'ESModule', path: path.join(directory, name) }))
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules, modulesRoot: directory,
    compatibilityDate: '2026-10-10', compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'local-pilot' },
    r2Buckets: { FILES: 'local-pilot-files' },
    bindings: { PROBE_ACCESS_TOKEN: accessToken, PROBE_SECRET: randomBytes(32).toString('hex'), PROBE_REMOTE: '1', PROBE_EXPIRES_AT: new Date(Date.now() + 60000).toISOString() },
  }))
  const originalFetch = globalThis.fetch
  const originalEnvironment = { ...process.env }
  try {
    const database = await mf.getD1Database('DB')
    await database.prepare(readFileSync('migrations/0001_probe.sql', 'utf8')).run()
    await database.prepare(readFileSync('migrations/0002_pilot_budget.sql', 'utf8')).run()
    process.env.PROBE_BASE_URL = 'https://pilot.test'
    process.env.PROBE_ACCESS_TOKEN = accessToken
    globalThis.fetch = (url, options) => mf.dispatchFetch(url, options)
    await import('../remote/smoke.mjs')
    await database.prepare("UPDATE pilot_budget SET requests = 998 WHERE id = 'pilot'").run()
    const race = await Promise.all(Array.from({ length: 8 }, () => mf.dispatchFetch('https://pilot.test/api/probe', { headers: { Authorization: `Bearer ${accessToken}` } })))
    assert.equal(race.filter(response => response.status === 200).length, 2)
    assert.equal(race.filter(response => response.status === 429).length, 6)
    assert.equal((await database.prepare("SELECT requests FROM pilot_budget WHERE id = 'pilot'").first()).requests, 1000)
  } finally {
    globalThis.fetch = originalFetch
    for (const key of ['PROBE_BASE_URL', 'PROBE_ACCESS_TOKEN']) {
      if (originalEnvironment[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnvironment[key]
    }
    await mf.dispose()
  }
})
