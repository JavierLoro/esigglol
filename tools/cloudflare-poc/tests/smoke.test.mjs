import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { createServer } from 'node:net'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

test('built vinext Worker: SSR, proxy, JWT, after, D1 rollback/CAS and R2 lifecycle', { timeout: 120_000 }, async () => {
  // Fail closed: this harness can only launch a local built Worker.
  const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'))
  assert.equal(config.name, 'esigglol-feasibility-local')
  assert.equal(config.workers_dev, false)
  assert.equal(config.d1_databases[0].database_id, '00000000-0000-0000-0000-000000000000')
  const secretFile = 'dist/server/.dev.vars'
  const secret = `PROBE_SECRET=${randomBytes(32).toString('hex')}\n`
  // Do not replace local credentials left by a developer.
  writeFileSync(secretFile, secret, { flag: 'wx', mode: 0o600 })
  let child
  let logs = ''
  try {
    execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--local'], {
      env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe', timeout: 30_000,
    })
    const listener = createServer()
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
    const port = listener.address().port
    await new Promise(resolve => listener.close(resolve))
    const base = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-20000) })
    let ready = false
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null) throw new Error(`Worker exited: ${logs}`)
      try { ready = (await fetch(`${base}/api/probe`, { signal: AbortSignal.timeout(1000) })).ok } catch { /* wait for local startup */ }
      if (ready) break
      await delay(250)
    }
    assert.ok(ready, `Worker did not start: ${logs}`)
    const home = await fetch(base)
    assert.equal(home.status, 200)
    assert.equal(home.headers.get('x-probe-proxy'), 'executed')
    assert.ok(home.headers.get('content-security-policy'))
    const html = await home.text()
    assert.match(html, /player#euw/)
    assert.match(html, /valid-bracket/)
    assert.match(html, /probe\.svg/)
    const asset = await fetch(`${base}/probe.svg`)
    assert.equal(asset.status, 200)
    assert.match(await asset.text(), /<svg/)
    assert.deepEqual(await (await fetch(`${base}/api/probe`)).json(), { scope: 'isolated-fixture', d1: true, r2: true })
    assert.equal((await fetch(`${base}/api/private`)).status, 401)
    assert.equal((await fetch(`${base}/api/private`, { headers: { Cookie: 'feasibility_session=invalid' } })).status, 401)
    assert.equal((await fetch(`${base}/api/storage`, { method: 'POST', body: '{}' })).status, 401)
    const signed = await fetch(`${base}/api/probe`, { method: 'POST' })
    assert.equal(signed.status, 200)
    const cookieHeader = signed.headers.get('set-cookie')
    assert.match(cookieHeader, /HttpOnly/i)
    assert.match(cookieHeader, /SameSite=Lax/i)
    const cookie = cookieHeader.split(';')[0]
    assert.deepEqual(await (await fetch(`${base}/api/private`, { headers: { Cookie: cookie } })).json(), { role: 'probe' })
    const post = operation => fetch(`${base}/api/storage`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ operation }),
    })
    assert.equal((await post('reset')).status, 200)
    assert.deepEqual(await (await post('rollback')).json(), { rolledBack: true })
    const race = await Promise.all(Array.from({ length: 8 }, () => post('cas')))
    assert.equal(race.filter(response => response.status === 200).length, 1)
    assert.equal(race.filter(response => response.status === 409).length, 7)
    assert.equal((await post('write-file')).status, 200)
    const object = await fetch(`${base}/api/storage`, { headers: { Cookie: cookie } })
    assert.equal(object.headers.get('content-type'), 'text/plain')
    assert.ok(object.headers.get('etag'))
    assert.equal(await object.text(), 'r2-round-trip')
    assert.equal((await post('delete-file')).status, 200)
    assert.equal((await fetch(`${base}/api/storage`, { headers: { Cookie: cookie } })).status, 404)
    let completed = false
    for (let attempt = 0; attempt < 40; attempt++) {
      completed = (await (await fetch(`${base}/api/after`)).json()).completed
      if (completed) break
      await delay(100)
    }
    assert.ok(completed, 'after() did not complete the bounded R2 side effect')
    const latency = {}
    for (const [name, url, headers] of [['ssr', '/', {}], ['json', '/api/probe', {}], ['jwt', '/api/private', { Cookie: cookie }]]) {
      const samples = []
      for (let index = 0; index < 20; index++) {
        const start = performance.now()
        const response = await fetch(`${base}${url}`, { headers })
        assert.equal(response.status, 200)
        await response.arrayBuffer()
        samples.push(performance.now() - start)
      }
      samples.sort((a, b) => a - b)
      latency[name] = { requests: samples.length, wallMsP50: samples[9], wallMsP95: samples[18] }
    }
    const report = { runtime: 'local-workerd', cpuMs: null, freePlanVerified: false, latency }
    writeFileSync('.wrangler/probe-results.json', JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report))
  } catch (error) {
    console.error(logs)
    throw error
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM')
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)])
      if (child.exitCode === null) child.kill('SIGKILL')
    }
    unlinkSync(secretFile)
  }
})
