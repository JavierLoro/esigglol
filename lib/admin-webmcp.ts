import { z } from 'zod'
import { MatchSchema, PhaseSchema, RoleSchema, TeamSchema } from './schemas'
import type { Match, Phase, Team, Tournament } from './types'

export const tournamentInput = z.strictObject({ tournamentId: z.string().min(1) })
export const entityInput = tournamentInput.extend({ id: z.string().min(1) })
const versionedInput = entityInput.extend({ version: z.number().int().positive() })
const playersInput = z.array(TeamSchema.shape.players.removeDefault().element.extend({ primaryRole: RoleSchema }))
export const createTeamInput = tournamentInput.extend({ name: TeamSchema.shape.name, players: playersInput.optional() })
export const updateTeamInput = versionedInput.extend({ name: TeamSchema.shape.name.optional(), players: playersInput.optional() })
  .refine(input => input.name !== undefined || input.players !== undefined, 'Indica el nombre o la plantilla que quieres actualizar')
export const createMatchInput = tournamentInput.extend({
  phaseId: MatchSchema.shape.phaseId, round: MatchSchema.shape.round,
  bracketPosition: MatchSchema.shape.bracketPosition,
  team1Id: MatchSchema.shape.team1Id, team2Id: MatchSchema.shape.team2Id,
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
})
export const scheduleMatchInput = versionedInput.extend({ scheduledAt: z.iso.datetime({ offset: true }).nullable() })
export const saveResultInput = versionedInput.extend({ result: MatchSchema.shape.result.removeDefault(), maps: MatchSchema.shape.maps })

export function tournamentForAgent(tournament: Tournament) {
  const { id, name, slug, game, platform, region, status } = tournament
  return { id, name, slug, game, platform, region, status }
}

export function teamForAgent(team: Team) {
  return { id: team.id, version: team.version, ...TeamSchema.parse(team) }
}

export function phaseForAgent(phase: Phase) {
  return { id: phase.id, version: phase.version, ...PhaseSchema.parse(phase) }
}

export function matchForAgent(match: Match) {
  const { id, version, phaseId, round, bracketPosition, team1Id, team2Id, result, winnerId, scheduledAt, maps } = match
  return { id, version, phaseId, round, bracketPosition, team1Id, team2Id, result: result && { team1Score: result.team1Score, team2Score: result.team2Score }, winnerId, scheduledAt,
    maps: maps?.map(({ map, team1Rounds, team2Rounds }) => ({ map, team1Rounds, team2Rounds })) }
}
