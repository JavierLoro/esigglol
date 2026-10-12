import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { readStaticAssets, manifestFingerprint, assertAssetBuild } from './asset-manifest.mjs'

const root = path.resolve('dist/client')
const { manifest, files } = readStaticAssets(root)
const manifestPath = '.wrangler/application-asset-manifest.json'
const fingerprint = manifestFingerprint(manifest)
if (process.argv.includes('--manifest')) {
  mkdirSync('.wrangler', { recursive: true })
  writeFileSync(manifestPath, JSON.stringify({ manifestFingerprint: fingerprint }), { mode: 0o600 })
  process.stdout.write(JSON.stringify(manifest))
} else {
  assertAssetBuild(JSON.parse(readFileSync(manifestPath, 'utf8')), manifest)
  // The connector creates a one-hour, upload-only JWT. It is supplied on stdin,
  // never as an argument or log entry; no account API token is needed here.
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  const input = createInterface({ input: process.stdin, terminal: false })
  const line = await new Promise(resolve => input.once('line', resolve))
  input.close()
  process.stdin.pause()
  const { accountId, session } = JSON.parse(line)
  let completion = session.bucket_count === 0 ? session.jwt : undefined
  const buckets = []
  // Send the complete registered manifest, including already cached assets.
  // This avoids depending on connector truncation of large hash arrays.
  if (session.bucket_count !== 0) {
    let group = []; let bytes = 0
    for (const hash of session.hashes ?? files.keys()) {
      const file = files.get(hash)
      if (!file) throw new Error('Assets changed after starting the upload session; create a new session')
      const size = manifest[`/${file.relative}`].size
      if (group.length && (group.length >= 100 || bytes + size > 16 * 1024 * 1024)) { buckets.push(group); group = []; bytes = 0 }
      group.push(hash); bytes += size
    }
    if (group.length) buckets.push(group)
  }
  for (const bucket of buckets) {
    const form = new FormData()
    for (const hash of bucket) {
      const file = files.get(hash)
      if (!file) throw new Error('Assets changed after starting the upload session; create a new session')
      form.append(hash, new Blob([readFileSync(path.join(root, file.relative)).toString('base64')], { type: file.type }), hash)
    }
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/assets/upload?base64=true`, { method: 'POST', headers: { Authorization: `Bearer ${session.jwt}` }, body: form, signal: AbortSignal.timeout(120000) })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(`Asset upload failed (${response.status}): ${JSON.stringify(result.errors)}`)
    if (result.result?.jwt) completion = result.result.jwt
    console.log(`Uploaded ${bucket.length} static assets`)
  }
  if (!completion) throw new Error('Missing assets completion token')
  assertAssetBuild({ manifestFingerprint: fingerprint }, readStaticAssets(root).manifest)
  mkdirSync('.wrangler', { recursive: true })
  writeFileSync('.wrangler/application-assets.json', JSON.stringify({ jwt: completion, manifestFingerprint: fingerprint }), { mode: 0o600 })
  console.log(`Static assets ready: ${Object.keys(manifest).length} files`)
}
