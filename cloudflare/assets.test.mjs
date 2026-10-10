import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readStaticAssets, manifestFingerprint, assertAssetBuild } from './asset-manifest.mjs'
import { verifyFrontend } from './frontend-check.mjs'

test('an asset completion from an earlier build cannot prepare a new Worker', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'esigglol-assets-'))
  try {
    writeFileSync(path.join(root, 'client.js'), 'export const version = 1')
    writeFileSync(path.join(root, '.temporary'), 'ignored')
    writeFileSync(path.join(root, 'catalog.zip'), 'ignored')
    const initial = readStaticAssets(root).manifest
    assert.equal(Object.keys(initial).length, 1)
    const uploaded = { manifestFingerprint: manifestFingerprint(initial) }
    assert.doesNotThrow(() => assertAssetBuild(uploaded, initial))
    writeFileSync(path.join(root, 'client.js'), 'export const version = 2')
    assert.throws(() => assertAssetBuild(uploaded, readStaticAssets(root).manifest), /do not match this build/)
    writeFileSync(path.join(root, 'client.js'), 'export const version = 1')
    renameSync(path.join(root, 'client.js'), path.join(root, 'client-new.js'))
    assert.throws(() => assertAssetBuild(uploaded, readStaticAssets(root).manifest), /do not match this build/)
    assert.throws(() => assertAssetBuild({ jwt: 'legacy-completion' }, initial), /do not match this build/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('manifest fingerprints are independent of entry ordering', () => {
  const a = { hash: 'a', size: 1 }; const b = { hash: 'b', size: 2 }
  assert.equal(manifestFingerprint({ '/a.js': a, '/b.css': b }), manifestFingerprint({ '/b.css': b, '/a.js': a }))
})

const markup = '<link rel="stylesheet" href="/client.css"><script type="module" src="/client.js"></script>'
function fakeRequest({ missing, htmlAsset, missingScripts } = {}) {
  return async url => {
    const name = new URL(url).pathname
    if (name === missing) return new Response('Not found', { status: 404 })
    if (/\.(?:js|css)$/.test(name)) return new Response('/* asset */', { headers: { 'content-type': htmlAsset ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'application/javascript' } })
    return new Response(missingScripts ? '<main>SSR only</main>' : markup, { headers: { 'content-type': 'text/html' } })
  }
}

test('SSR success does not mask missing client chunks', async () => {
  await assert.rejects(verifyFrontend('https://app.test', { request: fakeRequest({ missing: '/client.js' }) }), /client.js.*received 404/)
  await assert.rejects(verifyFrontend('https://app.test', { request: fakeRequest({ htmlAsset: true }) }), /expected CSS 200/)
  await assert.rejects(verifyFrontend('https://app.test', { request: fakeRequest({ missingScripts: true }) }), /no client scripts/)
})

test('check also covers lazy chunks absent from initial page markup', async () => {
  const manifest = { '/lazy.js': { hash: 'lazy', size: 1 } }
  await assert.rejects(verifyFrontend('https://app.test', { manifest, request: fakeRequest({ missing: '/lazy.js' }) }), /lazy.js.*received 404/)
  assert.deepEqual(await verifyFrontend('https://app.test', { manifest, request: fakeRequest() }), { pages: 6, assets: 3 })
})
