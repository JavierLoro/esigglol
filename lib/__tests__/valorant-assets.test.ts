import { expect, it } from 'vitest'
import { valorantAsset, type ValorantAssetManifest } from '../valorant-assets'
const empty: ValorantAssetManifest = { version: 'test', catalogUrl: '', syncedAt: '', rankSource: '', agents: {}, cards: {}, maps: {}, ranks: {} }

it('resolves case-insensitive IDs and leaves unknown cards and ranks unavailable', () => {
  const manifest = { ...empty, cards: { uuid: { name: 'Card', icon: '/valorant/13.06/PlayerCards/UUID_small.png' } }, ranks: {} } as ValorantAssetManifest
  expect(valorantAsset(manifest, 'cards', 'UUID')?.name).toBe('Card')
  expect(valorantAsset(manifest, 'cards', 'missing')).toBeUndefined()
  expect(valorantAsset(manifest, 'ranks', 27)).toBeUndefined()
  expect(valorantAsset(null, 'ranks', 27)).toBeUndefined()
})
it('does not expose remote or traversing image URLs from a malformed manifest', () => {
  for (const icon of ['https://example.com/icon.png', '/valorant/../secret.png']) {
    const manifest = { ...empty, cards: { uuid: { name: 'Bad', icon } } } as ValorantAssetManifest
    expect(valorantAsset(manifest, 'cards', 'uuid')).toBeUndefined()
  }
})
