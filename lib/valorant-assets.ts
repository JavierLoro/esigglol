import fs from 'node:fs'
import path from 'node:path'

export type ValorantAsset = { name: string; icon: string }
export interface ValorantAssetManifest {
  version: string
  catalogUrl: string
  syncedAt: string
  rankSource: string
  agents: Record<string, ValorantAsset>
  cards: Record<string, ValorantAsset>
  maps: Record<string, ValorantAsset>
  ranks: Record<string, ValorantAsset>
}
export const VALORANT_ASSETS_DIR = path.join(process.cwd(), 'public', 'valorant')
export function getValorantAssets(): ValorantAssetManifest | null {
  try { return JSON.parse(fs.readFileSync(path.join(VALORANT_ASSETS_DIR, 'manifest.json'), 'utf8')) }
  catch { return null }
}
export function valorantAsset(manifest: ValorantAssetManifest | null, kind: 'agents' | 'cards' | 'maps' | 'ranks', id: string | number | undefined): ValorantAsset | undefined {
  if (id === undefined) return undefined
  const asset = manifest?.[kind]?.[String(id).toLowerCase()]
  return asset && /^\/valorant\/[a-zA-Z0-9/_.-]+$/.test(asset.icon) && !asset.icon.includes('..') ? asset : undefined
}
