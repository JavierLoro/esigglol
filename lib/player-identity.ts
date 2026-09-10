export function normalizeRiotId(value: string): string {
  return value.trim().replace(/\s*#\s*/g, '#').toLocaleLowerCase()
}

import type { PlayerRow, Team } from './types'

export function reconcileCachedPlayers(cachedPlayers: PlayerRow[], teams: Team[]): PlayerRow[] {
  const players = teams.flatMap(team => team.players.map(player => ({ player, team })))
  const byId = new Map(players.map(entry => [entry.player.id, entry]))
  const byName = new Map(players.map(entry => [normalizeRiotId(entry.player.summonerName), entry]))

  return cachedPlayers.flatMap(cached => {
    const entry = byId.get(cached.playerId) ?? byName.get(normalizeRiotId(cached.summonerName))
    if (!entry) return []
    return [{
      ...cached,
      playerId: entry.player.id,
      summonerName: entry.player.summonerName,
      teamId: entry.team.id,
      teamName: entry.team.name,
      teamLogo: entry.team.logo,
      primaryRole: entry.player.primaryRole,
      secondaryRole: entry.player.secondaryRole,
    }]
  })
}
