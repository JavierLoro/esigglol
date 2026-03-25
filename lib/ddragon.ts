import fs from 'node:fs'
import path from 'node:path'
import logger from '@/lib/logger'
import { PROFILE_ICONS_DIR } from '@/lib/env'

const log = logger.child({ module: 'ddragon' })

const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
const DDRAGON_CDN = 'https://ddragon.leagueoflegends.com/cdn'
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images'

const VERSION_FILE = path.join(process.cwd(), 'data', 'ddragon-version.txt')
const ASSETS_DIR = path.join(process.cwd(), 'public', 'ddragon')

const TIERS = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger']

// ── Version helpers ─────────────────────────────────────────────────────────

export function getVersion(): string | null {
  try {
    return fs.readFileSync(VERSION_FILE, 'utf-8').trim()
  } catch {
    return null
  }
}

function saveVersion(version: string): void {
  fs.mkdirSync(path.dirname(VERSION_FILE), { recursive: true })
  fs.writeFileSync(VERSION_FILE, version, 'utf-8')
}

async function fetchLatestVersion(): Promise<string> {
  const res = await fetch(VERSIONS_URL)
  if (!res.ok) throw new Error(`Failed to fetch DDragon versions: ${res.status}`)
  const versions = await res.json() as string[]
  return versions[0]
}

// ── Download helpers ────────────────────────────────────────────────────────

async function downloadFile(url: string, dest: string): Promise<void> {
  const dir = path.dirname(dest)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const res = await fetch(url)
  if (!res.ok) {
    log.warn({ url, status: res.status }, 'Failed to download asset')
    return
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buffer)
}

// ── Sync: ranked emblems ────────────────────────────────────────────────────

async function syncRankedEmblems(): Promise<void> {
  const destDir = path.join(ASSETS_DIR, 'ranked')
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  const allTiers = [...TIERS, 'unranked']
  await Promise.all(allTiers.map(async tier => {
    const dest = path.join(destDir, `${tier}.svg`)
    if (fs.existsSync(dest)) return
    const url = `${CDRAGON_BASE}/ranked-mini-crests/${tier}.svg`
    await downloadFile(url, dest)
    log.info({ tier }, 'Downloaded ranked mini crest')
  }))
}

// ── Sync: champion data ─────────────────────────────────────────────────────

async function syncChampionData(version: string): Promise<void> {
  const dest = path.join(ASSETS_DIR, 'champion.json')
  const url = `${DDRAGON_CDN}/${version}/data/es_ES/champion.json`
  await downloadFile(url, dest)
  log.info({ version }, 'Downloaded champion data')
}

// ── Main sync ───────────────────────────────────────────────────────────────

export async function checkAndUpdate(): Promise<void> {
  const latest = await fetchLatestVersion()
  const local = getVersion()

  if (local === latest) {
    log.info({ version: latest }, 'Assets up to date')
    return
  }

  log.info({ from: local ?? 'none', to: latest }, 'Updating DDragon assets')

  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true })

  await Promise.all([
    syncRankedEmblems(),
    syncChampionData(latest),
  ])

  saveVersion(latest)
  log.info({ version: latest }, 'Sync complete')
}

// ── Profile icon (on-demand download) ───────────────────────────────────────

export async function ensureProfileIcon(iconId: number): Promise<void> {
  const dest = path.join(PROFILE_ICONS_DIR, `${iconId}.png`)
  if (fs.existsSync(dest)) return

  const version = getVersion()
  if (!version) return

  const url = `${DDRAGON_CDN}/${version}/img/profileicon/${iconId}.png`
  await downloadFile(url, dest)
}

// ── URL helpers (for use in components) ─────────────────────────────────────

export function profileIconUrl(iconId: number | undefined): string {
  if (!iconId) return ''
  return `/api/ddragon/profileicon/${iconId}`
}

export function rankedEmblemUrl(tier: string): string {
  return `/ddragon/ranked/${tier.toLowerCase()}.svg`
}
