import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'

mkdirSync('.wrangler', { recursive: true })
const secretPath = '.wrangler/application-secrets.json'
if (!existsSync(secretPath)) writeFileSync(secretPath, JSON.stringify({ SESSION_SECRET: randomBytes(48).toString('base64url'), ADMIN_PASSWORD_HASH: await bcrypt.hash(randomBytes(32).toString('base64url'), 12), BOOTSTRAP_TOKEN: randomBytes(32).toString('base64url'), BOOTSTRAP_EXPIRES: new Date(Date.now() + 86400000).toISOString() }), { mode: 0o600 })
const secrets = JSON.parse(readFileSync(secretPath, 'utf8'))
const assets = JSON.parse(readFileSync('.wrangler/application-assets.json', 'utf8'))
const boundary = `esigglol-${randomBytes(16).toString('hex')}`
const metadata = { main_module: 'index.mjs', compatibility_date: '2026-10-10', compatibility_flags: ['nodejs_compat'],
  migrations: process.argv.includes('--existing') ? undefined : { new_tag: 'v1', new_sqlite_classes: ['EsiggApplication', 'FileBudget'] },
  bindings: [
    { name: 'APPLICATION', type: 'durable_object_namespace', class_name: 'EsiggApplication' },
    { name: 'FILE_BUDGET', type: 'durable_object_namespace', class_name: 'FileBudget' },
    { name: 'FILES', type: 'r2_bucket', bucket_name: 'esigglol-application' },
    { name: 'ASSETS', type: 'assets' },
    ...Object.entries({ NODE_ENV: 'production', IS_CLOUDFLARE: '1', INSTALLATION_ID: 'esiggesports', REFRESH_AUTO_INTERVAL_MS: '21600000' }).map(([name, text]) => ({ name, type: 'plain_text', text })),
    ...Object.entries(secrets).map(([name, text]) => ({ name, type: 'secret_text', text })),
  ],
  assets: { jwt: assets.jwt, config: { html_handling: 'none', not_found_handling: 'none' } },
  observability: { enabled: true, head_sampling_rate: 0.1, redact_query_string: true },
}
const parts = [`--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}`]
let count = 0
function walk(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) { walk(path.join(dir, entry.name), name); continue }
    if (!/\.m?js$/.test(name)) continue
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}"\r\nContent-Type: application/javascript+module\r\n\r\n${readFileSync(path.join(dir, entry.name), 'utf8')}`)
    count++
  }
}
walk('dist/server')
parts.push(`--${boundary}--\r\n`)
writeFileSync('.wrangler/application-upload.json', JSON.stringify({ contentType: `multipart/form-data; boundary=${boundary}`, body: parts.join('\r\n') }), { mode: 0o600 })
console.log(`Prepared ${count} Worker modules; secrets retained in ignored local files`)
