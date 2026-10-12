import { readdirSync, cpSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const target = path.resolve('cloudflare/generated/public')
rmSync(target, { recursive: true, force: true })
function copy(source, destination) {
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.zip') || entry.name === 'PublicContentCatalog.json') continue
    if (entry.isDirectory()) copy(path.join(source, entry.name), path.join(destination, entry.name))
    else if (entry.isFile()) cpSync(path.join(source, entry.name), path.join(destination, entry.name))
  }
}
copy('public', target)
