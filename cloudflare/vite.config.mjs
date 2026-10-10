import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import vinext from 'vinext'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const adapters = new Map([['db', 'db'], ['file-store', 'file-store'], ['logger', 'logger'], ['metrics', 'metrics'], ['logo-cleanup', 'logo-cleanup'], ['ddragon', 'ddragon'], ['valorant-assets', 'valorant-assets'], ['refresh', 'refresh']])
function readAsset(name, fallback) { try { return JSON.parse(readFileSync(path.join(root, name), 'utf8')) } catch { return fallback } }
export default defineConfig({
  root,
  publicDir: path.join(root, 'cloudflare/generated/public'),
  resolve: { alias: [
    ...[...adapters].map(([name, adapter]) => ({ find: `@/lib/${name}`, replacement: path.join(root, 'cloudflare', `${adapter}.ts`) })),
  ] },
  plugins: [
    {
      name: 'esigglol-runtime-adapters', enforce: 'pre',
      async resolveId(source, importer) {
        if (source === 'virtual:esigglol-assets') return '\0esigglol-assets'
        if (!importer || !source.startsWith('.') && !source.startsWith('@/lib/')) return
        const resolved = source.startsWith('@/') ? path.join(root, source.slice(2)) : path.resolve(path.dirname(importer), source)
        for (const [name, adapter] of adapters) {
          if (importer === path.join(root, 'cloudflare', `${adapter}.ts`)) continue
          if (resolved === path.join(root, 'lib', name) || resolved === path.join(root, 'lib', `${name}.ts`)) return path.join(root, 'cloudflare', `${adapter}.ts`)
        }
      },
      load(id) {
        if (id === '\0esigglol-assets') {
          let version = ''
          try { version = readFileSync(path.join(root, 'data/ddragon-version.txt'), 'utf8').trim() } catch { /* local assets have not been synced */ }
          return `export default ${JSON.stringify({ champions: readAsset('public/ddragon/champion.json', { data: {} }), version, valorant: readAsset('public/valorant/manifest.json', null) })}`
        }
      },
    },
    vinext(),
    cloudflare({ configPath: path.join(root, 'cloudflare/wrangler.jsonc'), inspectorPort: false, viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } }),
    {
      name: 'esigglol-ssr-entry-extension', enforce: 'post',
      outputOptions(options) {
        // vinext's runtime SSR loader targets ssr/index.js; Vite 8 defaults to .mjs.
        if (this.environment.name === 'ssr') return { ...options, entryFileNames: '[name].js' }
      },
    },
  ],
})
