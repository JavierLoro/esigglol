import assets from './assets'

export function getVersion(): string | null { return assets.version || null }
export async function ensureProfileIcon(_id: number): Promise<void> { void _id }
export async function checkAndUpdate(): Promise<void> { throw new Error('Assets must be synchronized at build time') }
export function profileIconUrl(id: number | undefined): string { return id ? `/api/ddragon/profileicon/${id}` : '' }
export function rankedEmblemUrl(tier: string): string { return `/ddragon/ranked/${tier.toLowerCase()}.svg` }
export function buildChampionNameMap(): Map<string, string> { return new Map(Object.keys(assets.champions.data ?? {}).map(name => [name.toLowerCase(), name])) }
