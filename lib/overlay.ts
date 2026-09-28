import { z } from 'zod'
import type { Match, Phase } from './types'
import { getPublishedMatches, isPhasePublished } from './publication'
import { orderBracketMatches } from './bracket-position'
import { getGroupStandings, type Standing } from './group-standings'
import { getSwissRecords } from './swiss'

const optionalFlag = z.boolean().optional()
export const DEFAULT_OVERLAY_COLOR = '#ff5f98'
const scoreboardVisibility = z.object({ logos: optionalFlag, tournament: optionalFlag, bo: optionalFlag }).strict()
const sceneVisibility = scoreboardVisibility.extend({ eyebrow: optionalFlag, brand: optionalFlag, context: optionalFlag, status: optionalFlag, footer: optionalFlag, empty: optionalFlag }).strict()
const previaVisibility = sceneVisibility.extend({ date: optionalFlag, maps: optionalFlag }).strict()
const phaseVisibility = sceneVisibility.extend({ columnTitles: optionalFlag, page: optionalFlag, history: optionalFlag, content: z.enum(['both', 'standings', 'matches']).optional() }).strict()
export type OverlayDetails = z.infer<typeof previaVisibility> & Pick<z.infer<typeof phaseVisibility>, 'columnTitles' | 'page'>
export type OverlayKind = 'marcador' | 'previa' | 'fase'
export const overlayDetailLabels: Record<OverlayKind, Partial<Record<keyof OverlayDetails, string>>> = {
  marcador: { logos: 'Logos', tournament: 'Nombre del torneo', bo: 'BO' },
  previa: { logos: 'Logos', tournament: 'Nombre del torneo', eyebrow: 'Rótulo de juego y vista', brand: 'Marca ESIgg', context: 'Fase y ronda', bo: 'BO', date: 'Fecha', maps: 'Mapas de Valorant', status: 'Estado del resultado', footer: 'Pie', empty: 'Mostrar aviso sin contenido' },
  fase: { logos: 'Logos', tournament: 'Nombre del torneo', eyebrow: 'Rótulo de juego y vista', brand: 'Marca ESIgg', context: 'Fase, grupo y ronda', columnTitles: 'Títulos de columnas', page: 'Número de página', bo: 'BO de encuentros', status: 'Estado de encuentros', footer: 'Pie', empty: 'Mostrar aviso sin contenido' },
}

export const OverlayConfigSchema = z.object({
  matchId: z.string().min(1).max(200).nullable(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  summary: z.object({
    phaseId: z.string().min(1).max(200),
    section: z.string().min(1).max(200),
    page: z.number().int().min(1),
  }).strict().nullable().optional(),
  visibility: z.object({
    marcador: scoreboardVisibility.optional(),
    previa: previaVisibility.optional(),
    fase: phaseVisibility.optional(),
  }).strict().optional(),
}).strict()
export type OverlayConfig = z.infer<typeof OverlayConfigSchema>
export interface OverlayColumn {
  title: string
  slot?: number
  matches?: Match[]
  standings?: Standing[]
  rankStart?: number
  // Only adjacent rounds in the same bracket branch have connectors.
  connects?: boolean
}
export interface OverlayPage { columns: OverlayColumn[]; overview?: boolean }

export function overlayRoundLabel(phase: Phase, round: number, matches: Match[]) {
  if (round === 98) return 'Tercer puesto'
  if (round === 99) return 'Gran final'
  if (phase.type === 'upper-lower') return `${round < 0 ? 'Lower' : 'Upper'} · Ronda ${Math.abs(round)}`
  if (phase.type === 'elimination' || phase.type === 'final-four') {
    const final = phase.config.bracketTeamIds?.length ? Math.log2(phase.config.bracketTeamIds.length) : Math.max(...matches.filter(m => m.round > 0 && m.round < 98).map(m => m.round))
    if (round === final) return 'Final'
    if (round === final - 1) return 'Semifinales'
    if (round === final - 2) return 'Cuartos de final'
  }
  return `Ronda ${round}`
}

export function overlaySections(phase: Phase, allMatches: Match[]) {
  if (!isPhasePublished(phase)) return []
  if (phase.type === 'groups') return (phase.config.groups ?? []).map(g => ({ id: `group:${g.id}`, label: `Grupo ${g.id}` }))
  const matches = getPublishedMatches([phase], allMatches)
  return [...new Set(matches.map(m => m.round))]
    .sort((a, b) => (a < 0 ? 50 - a : a) - (b < 0 ? 50 - b : b))
    .map(round => ({ id: `round:${round}`, label: overlayRoundLabel(phase, round, matches) }))
}

export function overlayPages(phase: Phase, allMatches: Match[], section: string, content: 'both' | 'standings' | 'matches' = phase.type === 'swiss' ? 'matches' : 'both'): OverlayPage[] {
  if (!overlaySections(phase, allMatches).some(s => s.id === section)) return []
  const matches = getPublishedMatches([phase], allMatches)
  const round = Number(section.slice('round:'.length))
  if (phase.type === 'swiss' && content === 'matches') {
    const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b)
    return [{ overview: true, columns: rounds.map(r => ({
      title: overlayRoundLabel(phase, r, matches),
      matches: orderBracketMatches(matches.filter(m => m.round === r)),
    })) }]
  }
  if (phase.type === 'groups' || phase.type === 'swiss') {
    const group = phase.config.groups?.find(g => `group:${g.id}` === section)
    const teamIds = phase.type === 'groups' ? group!.teamIds : phase.config.swissTeamIds ?? []
    const selected = phase.type === 'groups'
      ? matches.filter(m => teamIds.includes(m.team1Id) && teamIds.includes(m.team2Id))
      : matches.filter(m => m.round === round)
    const records = getSwissRecords(matches.filter(m => m.round <= round), teamIds)
    const standings = phase.type === 'groups' ? getGroupStandings(teamIds, selected)
      : teamIds.map(teamId => ({ teamId, ...records[teamId], points: 0 })).sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    const standingsPages = Math.max(1, Math.ceil(standings.length / 12))
    const count = Math.max(1, content !== 'matches' ? standingsPages : 0, content !== 'standings' ? Math.ceil(selected.length / 8) : 0)
    return Array.from({ length: count }, (_, index) => ({ columns: [
      // Keep the standings present while paging through the longer match list.
      { title: 'Clasificación', slot: 1, standings: content !== 'matches' ? standings.slice((index % standingsPages) * 12, (index % standingsPages + 1) * 12) : [], rankStart: (index % standingsPages) * 12 + 1 },
      ...[0, 4].map((offset, column) => ({ title: 'Partidos', slot: column + 2, matches: content !== 'standings' ? selected.slice(index * 8 + offset, index * 8 + offset + 4) : [] })),
    ].filter((c: OverlayColumn) => c.standings?.length || c.matches?.length) }))
  }

  const rounds = [...new Set(matches.map(m => m.round))]
    .filter(r => round >= 98 ? r === round : round < 0 ? r <= round : r >= round && r < 98)
    .sort((a, b) => Math.abs(a) - Math.abs(b)).slice(0, 3)
  if (phase.type === 'final-four' && round < 98 && rounds.length < 3 && matches.some(m => m.round === 98)) rounds.push(98)
  const firstRound = orderBracketMatches(matches.filter(m => m.round === round))
  return Array.from({ length: Math.max(1, Math.ceil(firstRound.length / 4)) }, (_, page) => {
    let start = page * 4
    let end = Math.min(firstRound.length, start + 4)
    let previousCount = firstRound.length
    return { columns: rounds.map((r, index) => {
      const inRound = orderBracketMatches(matches.filter(m => m.round === r))
      if (index > 0) {
        const ratio = previousCount / Math.max(1, inRound.length)
        start = Math.floor(start / ratio)
        end = Math.ceil(end / ratio)
      }
      previousCount = inRound.length
      return { title: overlayRoundLabel(phase, r, matches), matches: inRound.slice(start, end), connects: index > 0 && r !== 98 }
    }) }
  })
}

export function resolveOverlay(config: OverlayConfig, phases: Phase[], allMatches: Match[]) {
  const matches = getPublishedMatches(phases, allMatches)
  const match = matches.find(m => m.id === config.matchId)
  const phase = phases.find(p => p.id === (config.summary?.phaseId ?? match?.phaseId) && isPhasePublished(p))
  if (!phase) return { match, phase: undefined, summary: undefined, pages: [] }
  let summary = config.summary
  const content = config.visibility?.fase?.content
  if (!summary && match) {
    const group = phase.config.groups?.find(g => g.teamIds.includes(match.team1Id) && g.teamIds.includes(match.team2Id))
    const section = phase.type === 'groups' ? `group:${group?.id}` : `round:${match.round}`
    const pages = overlayPages(phase, matches, section, content)
    let index = pages.findIndex(p => p.columns.some(c => c.matches?.some(m => m.id === match.id)))
    if (content === 'standings' && (phase.type === 'groups' || phase.type === 'swiss')) {
      index = pages.findIndex(p => p.columns.some(c => c.standings?.some(s => s.teamId === match.team1Id)))
      if (index < 0) index = pages.findIndex(p => p.columns.some(c => c.standings?.some(s => s.teamId === match.team2Id)))
      if (index < 0) index = 0
    }
    summary = { phaseId: phase.id, section, page: index + 1 }
  }
  const pages = summary ? overlayPages(phase, matches, summary.section, content) : []
  if (summary && pages[0]?.overview) summary = { ...summary, page: 1 }
  if (!summary || !pages[summary.page - 1]) return { match, phase: undefined, summary: undefined, pages: [] }
  return { match, phase, summary, pages }
}

export function overlayConfigError(config: OverlayConfig, phases: Phase[], matches: Match[]): string | null {
  if (config.matchId && !getPublishedMatches(phases, matches).some(m => m.id === config.matchId)) return 'El partido no pertenece al torneo o no está publicado'
  if (config.summary) {
    const phase = phases.find(p => p.id === config.summary!.phaseId)
    if (!phase || !overlayPages(phase, matches, config.summary.section, config.visibility?.fase?.content)[config.summary.page - 1]) return 'La fase, grupo/ronda o página no está disponible para emisión'
  }
  return null
}
