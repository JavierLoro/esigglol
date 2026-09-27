import type { CompetitiveDetails, Game, Match, Player, Role, ValorantRole } from './types'

export const VALORANT_ROLES: readonly ValorantRole[] = ['Duelista', 'Iniciador', 'Controlador', 'Centinela', 'Flexible']
export type RosterDetails =
  | { game: 'lol'; primaryRole: Exclude<Role, ValorantRole>; secondaryRole?: Exclude<Role, ValorantRole | 'Suplente'> }
  | { game: 'valorant'; riotId: string; status: 'starter' | 'substitute'; role?: ValorantRole }

/** Converts the backwards-compatible persistence envelope into game-specific data. */
export function competitiveDetails(match: Match, game: Game = match.game ?? 'lol'): CompetitiveDetails {
  return game === 'valorant' ? { game, maps: match.maps } : { game, games: match.games }
}
export function rosterDetails(player: Player, game: Game): RosterDetails {
  if (game === 'valorant') return { game, riotId: player.summonerName, status: player.rosterStatus ?? 'starter', role: VALORANT_ROLES.includes(player.primaryRole as ValorantRole) ? player.primaryRole as ValorantRole : undefined }
  return { game, primaryRole: player.primaryRole as Exclude<Role, ValorantRole>, secondaryRole: player.secondaryRole as Exclude<Role, ValorantRole | 'Suplente'> | undefined }
}
