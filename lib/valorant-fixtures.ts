/** Explicit development fixture. The private route checks NODE_ENV and admin auth first. */
export const valorantPreviewFixture = {
  fixture: true,
  identity: { source: 'Riot Games', availability: 'available', fetchedAt: '2026-09-01T10:00:00Z', data: { puuid: 'fixture-player', gameName: 'Ejemplo', tagLine: 'FIXTURE' } },
  content: { source: 'Riot Games', availability: 'available', fetchedAt: '2026-09-01T10:00:00Z', data: { version: 'fixture', acts: [{ id: 'fixture-act', name: 'Acto de ejemplo', isActive: true, type: 'act' }], maps: [] } },
  history: { source: 'Riot Games', availability: 'available', fetchedAt: '2026-09-01T10:00:00Z', data: { puuid: 'fixture-player', history: [{ matchId: 'fixture-match', gameStartTimeMillis: 1788256800000, queueId: 'competitive' }] } },
  detail: { source: 'Riot Games', availability: 'available', fetchedAt: '2026-09-01T10:00:00Z', data: { matchInfo: { matchId: 'fixture-match', mapId: 'fixture-map' }, players: [{ puuid: 'fixture-player', teamId: 'Blue', competitiveTier: 21 }] } },
  profile: { playerId: 'preview', source: 'Riot Games', availability: 'available', actId: 'fixture-act', fetchedAt: '2026-09-01T10:00:00Z', rankedRating: 100, leaderboardRank: 700 },
} as const
