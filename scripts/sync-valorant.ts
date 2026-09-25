import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { open, type Entry } from 'yauzl'
import { getValorantAssets, VALORANT_ASSETS_DIR, type ValorantAssetManifest } from '../lib/valorant-assets'

const docs = 'https://developer.riotgames.com/docs/valorant'
const rankSource = 'https://valorant-api.com/v1/competitivetiers'
type CatalogItem = { id: string; name: { defaultText: string; localizedByCulture?: Record<string, string> } }
type Catalog = { version: string; characters: CatalogItem[]; playerCards: CatalogItem[]; maps: CatalogItem[] }
async function get(url: string, timeout = 30_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
  return response
}
// Allowlisted flat filenames only. Never extract arbitrary ZIP paths.
function wanted(name: string) {
  return name === 'PublicContentCatalog.json' || /^(Characters|PlayerCards)\/[A-Fa-f0-9-]{36}_small\.png$/.test(name) || /^Maps\/[A-Fa-f0-9-]{36}\.png$/.test(name)
}
async function extract(zipPath: string, dest: string) {
  return new Promise<void>((resolve, reject) => {
    open(zipPath, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) { reject(error); return }
      zip.on('error', reject)
      zip.on('end', resolve)
      zip.on('entry', (entry: Entry) => {
        if (!wanted(entry.fileName)) { zip.readEntry(); return }
        if (entry.uncompressedSize > 30 * 1024 * 1024) { zip.close(); reject(new Error('Catalog entry too large')); return }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { zip.close(); reject(streamError); return }
          const target = path.join(dest, entry.fileName)
          void mkdir(path.dirname(target), { recursive: true }).then(() => pipeline(stream, createWriteStream(target))).then(() => zip.readEntry()).catch(err => { zip.close(); reject(err) })
        })
      })
      zip.readEntry()
    })
  })
}
async function sync() {
  const html = await (await get(docs)).text()
  const catalogUrl = html.match(/https:\/\/valorant\.dyn\.riotcdn\.net\/x\/content-catalog\/PublicContentCatalog-release-[0-9.]+\.zip/)?.[0]
  if (!catalogUrl) throw new Error('No official catalog link found')
  const previous = getValorantAssets()
  if (!process.argv.includes('--force') && previous?.catalogUrl === catalogUrl && Object.keys(previous.ranks).length === 25 && Object.keys(previous.cards).length > 0 && Object.keys(previous.agents).length > 0 && [...Object.values(previous.agents), ...Object.values(previous.cards), ...Object.values(previous.maps), ...Object.values(previous.ranks)].every(asset => existsSync(path.join(process.cwd(), 'public', asset.icon)))) {
    console.log(`[Valorant] Assets up to date (${previous.version})`); return
  }
  const version = catalogUrl.match(/release-([0-9.]+)\.zip/)![1]
  const directory = `${version}-${randomUUID().slice(0, 8)}`
  const dest = path.join(VALORANT_ASSETS_DIR, directory)
  await mkdir(dest, { recursive: true })
  const zipArg = process.argv.indexOf('--zip')
  const localZip = zipArg >= 0 ? process.argv[zipArg + 1] : undefined
  const zipPath = localZip ?? path.join(dest, 'catalog.zip')
  try {
    if (!localZip) {
      console.log('[Valorant] Downloading official catalog (about 1.5 GB; only on version changes)')
      const response = await get(catalogUrl, 600_000)
      if (!response.body) throw new Error('Empty catalog response')
      await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(zipPath))
    }
    await extract(zipPath, dest)
    const catalog = JSON.parse(await readFile(path.join(dest, 'PublicContentCatalog.json'), 'utf8')) as Catalog
    if (!catalog.version.startsWith(`${version}.`)) throw new Error('ZIP version does not match current official catalog')
    const manifest: ValorantAssetManifest = { version: catalog.version, catalogUrl, syncedAt: new Date().toISOString(), rankSource, agents: {}, cards: {}, maps: {}, ranks: {} }
    for (const [kind, folder, items, suffix] of [
      ['agents', 'Characters', catalog.characters, '_small'],
      ['cards', 'PlayerCards', catalog.playerCards, '_small'],
      ['maps', 'Maps', catalog.maps, ''],
    ] as const) {
      for (const item of items) {
        const filename = `${folder}/${item.id.toUpperCase()}${suffix}.png`
        if (existsSync(path.join(dest, filename))) manifest[kind][item.id.toLowerCase()] = { name: item.name.localizedByCulture?.['es-ES'] ?? item.name.defaultText, icon: `/valorant/${directory}/${filename}` }
      }
    }
    if (!Object.keys(manifest.agents).length || !Object.keys(manifest.cards).length) throw new Error('Incomplete official catalog')
    const ranks = await (await get(rankSource)).json() as { data: { tiers: { tier: number; tierName: string; smallIcon: string | null }[] }[] }
    const current = ranks.data.at(-1)
    if (!current?.tiers.some(t => t.tier === 27)) throw new Error('Invalid rank assets')
    await mkdir(path.join(dest, 'ranks'))
    for (const rank of current.tiers.filter(t => t.tier >= 3 && t.tier <= 27)) {
      if (!rank.smallIcon || new URL(rank.smallIcon).origin !== 'https://media.valorant-api.com') throw new Error('Invalid rank image host')
      const image = Buffer.from(await (await get(rank.smallIcon)).arrayBuffer())
      if (image.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('Invalid rank PNG')
      await writeFile(path.join(dest, 'ranks', `${rank.tier}.png`), image)
      manifest.ranks[String(rank.tier)] = { name: rank.tierName, icon: `/valorant/${directory}/ranks/${rank.tier}.png` }
    }
    if (Object.keys(manifest.ranks).length !== 25) throw new Error('Incomplete rank assets')
    const tempManifest = path.join(VALORANT_ASSETS_DIR, `manifest-${randomUUID()}.tmp`)
    await writeFile(tempManifest, JSON.stringify(manifest))
    await rename(tempManifest, path.join(VALORANT_ASSETS_DIR, 'manifest.json'))
    console.log(`[Valorant] ${manifest.version}: ${Object.keys(manifest.agents).length} agents, ${Object.keys(manifest.cards).length} cards, ${Object.keys(manifest.maps).length} maps, 25 ranks`)
  } finally { if (!localZip) await unlink(zipPath).catch(() => {}) }
}
sync().catch(error => {
  console.error('[Valorant] Sync failed; previous assets preserved:', error instanceof Error ? error.message : 'Unknown error')
  if (!process.argv.includes('--optional')) process.exitCode = 1
})
