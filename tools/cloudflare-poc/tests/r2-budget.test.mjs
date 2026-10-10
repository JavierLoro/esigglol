import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { createBudgetedBucket, readR2Budget, R2_LIMITS, RESERVE_R2_SQL } from '../lib/r2-budget.mjs'

test('R2 reservations use real D1 atomicity and fail before billable calls', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'budget-tests' },
  }))
  try {
    const database = await mf.getD1Database('DB')
    for (const sql of readFileSync('migrations/0003_r2_budget.sql', 'utf8').split(';').filter(sql => sql.trim())) {
      await database.prepare(sql).run()
    }
    const seed = (a = 0, b = 0, bytes = 0) => database.prepare("UPDATE r2_budget SET class_a = ?, class_b = ?, uploaded_bytes = ? WHERE id = 'pilot'").bind(a, b, bytes).run()
    let calls = []
    const bucket = {
      async put(key, body, options) { calls.push(['put', key, new Uint8Array(body), options]); return { key } },
      async get(key) { calls.push(['get', key]); return null },
      async head(key) { calls.push(['head', key]); return null },
      async delete(key) { calls.push(['delete', key]) },
    }
    const files = () => createBudgetedBucket(bucket, database)
    const quotaError = status => error => error.name === 'R2BudgetError' && error.status === status

    await t.test('D1 REST string parameters cannot bypass numeric quota comparisons', async () => {
      await seed()
      for (const [a, b, bytes] of [[101, 0, 0], [0, 1001, 0], [0, 0, R2_LIMITS.uploadedBytes + 1]]) {
        const params = [a, b, bytes, a, R2_LIMITS.classA, b, R2_LIMITS.classB, bytes, R2_LIMITS.uploadedBytes].map(String)
        assert.equal(await database.prepare(RESERVE_R2_SQL).bind(...params).first(), null)
      }
      assert.deepEqual((await readR2Budget(database)).used, { classA: 0, classB: 0, uploadedBytes: 0 })
    })

    await t.test('eight independent adapters compete for one read or write reservation', async () => {
      for (const operation of ['get', 'put']) {
        calls = []
        await seed(operation === 'put' ? 99 : 0, operation === 'get' ? 999 : 0)
        const results = await Promise.allSettled(Array.from({ length: 8 }, () => operation === 'get' ? files().get('key') : files().put('key', 'x')))
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
        assert.equal(results.filter(result => result.status === 'rejected' && result.reason.status === 429).length, 7)
        assert.equal(calls.length, 1)
        const { used } = await readR2Budget(database)
        assert.equal(operation === 'get' ? used.classB : used.classA, operation === 'get' ? 1000 : 100)
      }
    })

    await t.test('UTF-8 bytes and metadata reserve storage atomically without spending write slots on denial', async () => {
      calls = []
      // Two UTF-8 payload bytes plus two metadata bytes: only one fits.
      await seed(0, 0, R2_LIMITS.uploadedBytes - 4)
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => files().put('key', 'é')))
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
      assert.equal(calls.length, 1)
      assert.equal((await readR2Budget(database)).used.uploadedBytes, R2_LIMITS.uploadedBytes)
      assert.equal((await readR2Budget(database)).used.classA, 1)
      await assert.rejects(files().put('key', ''), quotaError(429))
      assert.equal(calls.length, 1)
    })

    await t.test('failed R2 calls keep reservations and missing reads count', async () => {
      await seed(99)
      let attempts = 0
      const failing = createBudgetedBucket({ async put() { attempts++; throw new Error('R2 timeout') } }, database)
      await assert.rejects(failing.put('key', 'x'), /R2 timeout/)
      await assert.rejects(failing.put('key', 'x'), quotaError(429))
      assert.equal(attempts, 1)
      await seed()
      assert.equal(await files().get('missing'), null)
      assert.equal(await files().head('missing'), null)
      assert.equal((await readR2Budget(database)).used.classB, 2)
    })

    await t.test('unknown-size streams, large objects and billable storage options never reach R2', async () => {
      calls = []
      await seed()
      await assert.rejects(files().put('key', new ReadableStream()), quotaError(400))
      await assert.rejects(files().put('key', new Uint8Array(R2_LIMITS.objectBytes + 1)), quotaError(413))
      await assert.rejects(files().put('key', 'é'.repeat(R2_LIMITS.objectBytes)), quotaError(413))
      await assert.rejects(files().put('key', 'x', { storageClass: 'InfrequentAccess' }), quotaError(400))
      await assert.rejects(files().put('key', 'x', { customMetadata: { extra: 'unmetered' } }), quotaError(400))
      await assert.rejects(files().put('key', 'x', { httpMetadata: { contentType: 'x'.repeat(129) } }), quotaError(400))
      assert.equal(calls.length, 0)
      assert.deepEqual((await readR2Budget(database)).used, { classA: 0, classB: 0, uploadedBytes: 0 })
      assert.equal(files().list, undefined)
      assert.equal(files().createMultipartUpload, undefined)
    })

    await t.test('deletion does not refund storage and reserved background writes are single-use snapshots', async () => {
      calls = []
      await seed()
      const body = new Uint8Array([1, 2, 3])
      const options = { httpMetadata: { contentType: 'text/plain' } }
      const complete = await files().preparePut('key', body, options)
      assert.equal(calls.length, 0)
      body[0] = 9
      options.httpMetadata.contentType = 'mutated'
      await complete()
      assert.deepEqual([...calls[0][2]], [1, 2, 3])
      assert.equal(calls[0][3].httpMetadata.contentType, 'text/plain')
      await assert.rejects(complete(), quotaError(409))
      const before = (await readR2Budget(database)).used
      await seed(100, 1000, R2_LIMITS.uploadedBytes)
      await files().delete('key')
      assert.equal(calls.at(-1)[0], 'delete')
      assert.equal((await readR2Budget(database)).used.uploadedBytes, R2_LIMITS.uploadedBytes)
      assert.ok(before.uploadedBytes > 3)
    })

    await t.test('missing counter and D1 errors fail closed without invoking R2', async () => {
      calls = []
      await database.prepare("DELETE FROM r2_budget WHERE id = 'pilot'").run()
      await assert.rejects(files().get('key'), quotaError(503))
      await assert.rejects(files().put('key', 'x'), quotaError(503))
      await assert.rejects(createBudgetedBucket(bucket, { prepare() { throw new Error('D1 unavailable') } }).get('key'), quotaError(503))
      assert.equal(calls.length, 0)
    })
  } finally { await mf.dispose() }
})
