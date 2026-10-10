import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'

const root = path.resolve('dist/client')
const types = { js: 'application/javascript', mjs: 'application/javascript', css: 'text/css', json: 'application/json', html: 'text/html', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf' }
const manifest = {}
const files = new Map()
function walk(directory, prefix = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.zip') || entry.name === 'PublicContentCatalog.json') continue
    const relative = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) { walk(path.join(directory, entry.name), relative); continue }
    const content = readFileSync(path.join(root, relative))
    if (content.byteLength > 25 * 1024 * 1024) throw new Error(`Static asset exceeds Free limit: ${relative}`)
    const type = types[relative.split('.').pop()] ?? 'application/octet-stream'
    const hash = createHash('sha256').update(type).update(content).digest('hex').slice(0, 32)
    manifest[`/${relative}`] = { hash, size: content.byteLength }
    files.set(hash, { relative, type })
  }
}
walk(root)
if (Object.keys(manifest).length > 20000) throw new Error('Static asset count exceeds Free limit')
if (process.argv.includes('--manifest')) {
  process.stdout.write(JSON.stringify(manifest))
} else {
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
      const size = manifest[`/${files.get(hash).relative}`].size
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
  mkdirSync('.wrangler', { recursive: true })
  writeFileSync('.wrangler/application-assets.json', JSON.stringify({ jwt: completion }), { mode: 0o600 })
  console.log(`Static assets ready: ${Object.keys(manifest).length} files`)
}
