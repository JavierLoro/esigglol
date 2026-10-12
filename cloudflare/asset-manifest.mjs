import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const types = { js: 'application/javascript', mjs: 'application/javascript', css: 'text/css', json: 'application/json', html: 'text/html', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf' }

export function readStaticAssets(root = path.resolve('dist/client')) {
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
  return { manifest, files }
}

export function manifestFingerprint(manifest) {
  const entries = Object.keys(manifest).sort().map(name => [name, manifest[name].hash, manifest[name].size])
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex')
}

export function assertAssetBuild(record, manifest) {
  if (record.manifestFingerprint !== manifestFingerprint(manifest)) {
    throw new Error('Static assets do not match this build. Generate a new manifest, upload its assets, then prepare the Worker again.')
  }
}
