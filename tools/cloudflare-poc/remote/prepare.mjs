import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Package the existing vinext build for connector/API upload, without credentials.
const target = process.env.PROBE_OUTPUT_DIR ?? '.wrangler/remote'
mkdirSync(target, { recursive: true })
cpSync('dist/server', target, { recursive: true, filter: source => !path.basename(source).startsWith('.') })
cpSync('remote/guard.mjs', `${target}/guard.mjs`)
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
const assets = {}
function walk(directory, prefix = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['_headers', '_redirects', 'wrangler.json'].includes(entry.name)) continue
    const relative = `${prefix}/${entry.name}`
    const source = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(source, relative)
    else {
      const type = mime[path.extname(entry.name)]
      if (!type) throw new Error(`Unsupported pilot asset: ${relative}`)
      assets[relative] = { body: readFileSync(source).toString('base64'), type }
    }
  }
}
walk('dist/client')
writeFileSync(`${target}/embedded-assets.mjs`, `export default ${JSON.stringify(assets)};\n`)
writeFileSync(`${target}/pilot.mjs`, `import worker from './index.js'
import { protectWorker } from './guard.mjs'
import assets from './embedded-assets.mjs'
const assetBinding = {
  async fetch(request) {
    const asset = assets[new URL(request.url).pathname]
    if (!asset) return new Response(null, { status: 404 })
    const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.body), char => char.charCodeAt(0))
    return new Response(body, { headers: { 'Content-Type': asset.type } })
  },
}
export default protectWorker({
  async fetch(request, env, ctx) {
    if (assets[new URL(request.url).pathname]) return assetBinding.fetch(request)
    return worker.fetch(request, { ...env, ASSETS: assetBinding }, ctx)
  },
})
`)
const databaseId = process.env.PROBE_DATABASE_ID ?? '00000000-0000-0000-0000-000000000000'
const expiresAt = process.env.PROBE_EXPIRES_AT ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const config = {
  name: 'esigglol-feasibility-pilot', main: 'pilot.mjs', no_bundle: true,
  compatibility_date: '2026-10-10', compatibility_flags: ['nodejs_compat'],
  workers_dev: true, preview_urls: false,
  rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
  vars: { PROBE_REMOTE: '1', PROBE_EXPIRES_AT: expiresAt },
  d1_databases: [{ binding: 'DB', database_name: 'esigglol-feasibility-pilot', database_id: databaseId }],
  observability: { enabled: true, head_sampling_rate: 1 },
}
if (process.env.PROBE_R2_BUCKET) config.r2_buckets = [{ binding: 'FILES', bucket_name: process.env.PROBE_R2_BUCKET }]
writeFileSync(`${target}/wrangler.json`, JSON.stringify(config, null, 2) + '\n')
console.log(JSON.stringify({ directory: target, assets: Object.keys(assets).length, expiresAt, r2: process.env.PROBE_R2_BUCKET ?? 'not-configured' }))
