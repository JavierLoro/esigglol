import { z } from 'zod'
import { validatePhaseParticipants } from './phase-validation'
import { isValidRiotMatchId, normalizeRiotMatchId, RIOT_MATCH_ID_ERROR } from './riot-match-id'
import { normalizeRiotId } from './player-identity'

const RoleSchema = z.enum(['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill', 'Suplente'])

const PlayerSchema = z.object({
  id: z.string().trim().min(1),
  summonerName: z.string().trim().min(1),
  primaryRole: RoleSchema,
  secondaryRole: z.enum(['Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Fill']).optional(),
})

export const TeamSchema = z.object({
  name: z.string().trim().min(1).max(100),
  logo: z.string().default(''),
  players: z.array(PlayerSchema).default([]),
}).superRefine((team, ctx) => {
  const ids = new Set<string>()
  const summonerNames = new Set<string>()
  team.players.forEach((player, index) => {
    if (ids.has(player.id)) ctx.addIssue({ code: 'custom', path: ['players', index, 'id'], message: 'El ID del jugador debe ser único' })
    ids.add(player.id)
    const name = normalizeRiotId(player.summonerName)
    if (summonerNames.has(name)) ctx.addIssue({ code: 'custom', path: ['players', index, 'summonerName'], message: 'El invocador no puede repetirse' })
    summonerNames.add(name)
  })
})

export const TeamUpdateSchema = TeamSchema.extend({
  id: z.string().min(1),
})

const BOFormatSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)])
const PhaseTypeSchema = z.enum(['groups', 'swiss', 'upper-lower', 'final-four', 'elimination'])
const PhaseStatusSchema = z.enum(['upcoming', 'active', 'completed'])

const GroupConfigSchema = z.object({
  id: z.string().min(1),
  teamIds: z.array(z.string()),
})

const PhaseConfigSchema = z.object({
  bo: BOFormatSchema,
  advanceCount: z.number().int().positive().optional(),
  groups: z.array(GroupConfigSchema).optional(),
  rounds: z.number().int().positive().optional(),
  swissTeamIds: z.array(z.string()).optional(),
  swissSize: z.union([z.literal(8), z.literal(16)]).optional(),
  advanceWins: z.number().int().positive().optional(),
  eliminateLosses: z.number().int().positive().optional(),
  roundBo: z.record(z.string(), BOFormatSchema).optional(),
  confirmedRounds: z.array(z.number()).optional(),
  bracketTeamIds: z.array(z.string()).optional(),
  include3rdPlace: z.boolean().optional(),
  confirmedBracket: z.boolean().optional(),
})

const PhaseSchemaBase = z.object({
  name: z.string().min(1).max(100),
  type: PhaseTypeSchema,
  status: PhaseStatusSchema.default('upcoming'),
  order: z.number().int().nonnegative(),
  config: PhaseConfigSchema,
})

function addPhaseValidation(phase: z.infer<typeof PhaseSchemaBase>, ctx: z.RefinementCtx) {
  for (const message of validatePhaseParticipants(phase.type, phase.config)) {
    const path = phase.type === 'groups' ? ['config', 'groups'] : phase.type === 'swiss' ? ['config', 'swissTeamIds'] : ['config', 'bracketTeamIds']
    ctx.addIssue({ code: 'custom', message, path })
  }
}

export const PhaseSchema = PhaseSchemaBase.superRefine(addPhaseValidation)

export const PhaseUpdateSchema = PhaseSchemaBase.extend({
  id: z.string().min(1),
}).superRefine(addPhaseValidation)

const MatchResultSchema = z.object({
  team1Score: z.number().int().nonnegative(),
  team2Score: z.number().int().nonnegative(),
})

const GamePlayerDataSchema = z.object({
  summonerName: z.string(),
  championName: z.string(),
  level: z.number().int().nonnegative(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  cs: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  items: z.array(z.string()).default([]),
  keystone: z.string().default(''),
})

export const GameDataSchema = z.object({
  duration: z.string(),
  date: z.string().optional(),
  winner: z.enum(['team1', 'team2']),
  team1Players: z.array(GamePlayerDataSchema),
  team2Players: z.array(GamePlayerDataSchema),
})

export const MatchSchema = z.object({
  phaseId: z.string().min(1),
  round: z.number().int(),
  bracketPosition: z.number().int().nonnegative().optional(),
  team1Id: z.string().min(1),
  team2Id: z.string().min(1),
  result: MatchResultSchema.nullable().default(null),
  winnerId: z.string().optional(),
  // null is an explicit empty slot, so deleting game 2 does not create an
  // invalid sparse array when the payload is serialized as JSON.
  riotMatchIds: z.array(
    z.string().transform(normalizeRiotMatchId).refine(isValidRiotMatchId, { message: RIOT_MATCH_ID_ERROR }).nullable(),
  ).default([]),
  games: z.array(GameDataSchema.nullable()).optional(),
  scheduledAt: z.string().optional(),
  tournamentCodes: z.array(z.string()).optional(),
  tournamentCodesGeneratedAt: z.string().optional(),
  tournamentCallbackToken: z.string().optional(),
}).superRefine((match, ctx) => {
  if (match.team1Id !== 'TBD' && match.team1Id === match.team2Id) {
    ctx.addIssue({ code: 'custom', path: ['team2Id'], message: 'Un partido debe tener dos equipos distintos' })
  }
  if (match.result === null) {
    if (match.winnerId !== undefined) ctx.addIssue({ code: 'custom', path: ['winnerId'], message: 'Un partido sin resultado no puede tener ganador' })
    return
  }
  if (match.result.team1Score === match.result.team2Score) {
    if (match.winnerId !== undefined) ctx.addIssue({ code: 'custom', path: ['winnerId'], message: 'Un resultado empatado no puede tener ganador' })
    return
  }
  // The effective BO is phase-dependent, so winner/completion validation is
  // performed by validateMatchResult after parsing. Partial scores are valid.
  if (match.winnerId !== undefined && match.winnerId !== match.team1Id && match.winnerId !== match.team2Id) {
    ctx.addIssue({ code: 'custom', path: ['winnerId'], message: 'El ganador debe ser uno de los equipos del partido' })
  }
})

export const MatchUpdateSchema = MatchSchema.extend({
  id: z.string().min(1),
})

export const MatchBulkSchema = z.union([MatchSchema, z.array(MatchSchema)])

export const GenerateSchema = z.object({
  phaseId: z.string().min(1),
  round: z.number().int().positive().optional(),
}).strict()

export const DeleteIdSchema = z.object({
  id: z.string().min(1),
})

export const DeleteIdsSchema = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
})

export const TournamentSetupSchema = z.object({
  tournamentName: z.string().min(1).max(100),
})

export const GenerateCodesSchema = z.object({
  matchId: z.string().min(1),
})
