import type { Match, Phase } from './types'
import { orderBracketMatches } from './bracket-position'

type Slot = 'team1Id' | 'team2Id'

function clearOutcome(match: Match): Match {
  return { ...match, result: null, winnerId: undefined, games: match.games?.map(() => null), riotMatchIds: match.riotMatchIds.map(() => null), tournamentCodes: undefined, tournamentCodesGeneratedAt: undefined, tournamentCallbackToken: undefined }
}

/** Rebuilds derived slots from current upstream results and invalidates incompatible outcomes. */
export function recalculateBracket(phase: Phase, allMatches: Match[]): Match[] {
  if (!['elimination', 'final-four', 'upper-lower'].includes(phase.type)) return allMatches
  const originalById = new Map(allMatches.map(match => [match.id, match]))
  const matches = allMatches.map(match => ({ ...match }))
  const phaseMatches = matches.filter(match => match.phaseId === phase.id)
  const inRound = (round: number) => orderBracketMatches(phaseMatches.filter(match => match.round === round))
  const setSlot = (target: Match | undefined, slot: Slot, teamId: string) => { if (target) target[slot] = teamId }
  const outcome = (match: Match) => {
    const original = originalById.get(match.id)
    if (original && (original.team1Id !== match.team1Id || original.team2Id !== match.team2Id)) Object.assign(match, clearOutcome(match))
    if (!match.result || !match.winnerId || match.team1Id === 'TBD' || match.team2Id === 'TBD' || match.result.team1Score === match.result.team2Score) return null
    if (match.winnerId !== match.team1Id && match.winnerId !== match.team2Id) { Object.assign(match, clearOutcome(match)); return null }
    return { winner: match.winnerId, loser: match.winnerId === match.team1Id ? match.team2Id : match.team1Id }
  }

  if (phase.type === 'elimination') {
    const rounds = [...new Set(phaseMatches.map(match => match.round))].filter(round => round > 0).sort((a, b) => a - b)
    for (const round of rounds.slice(1)) for (const match of inRound(round)) { match.team1Id = 'TBD'; match.team2Id = 'TBD' }
    rounds.slice(0, -1).forEach((round, roundIndex) => {
      const next = inRound(rounds[roundIndex + 1])
      inRound(round).forEach((match, storedIndex) => { const index = match.bracketPosition ?? storedIndex; const result = outcome(match); if (result) setSlot(next[Math.floor(index / 2)], index % 2 === 0 ? 'team1Id' : 'team2Id', result.winner) })
    })
  }

  if (phase.type === 'final-four') {
    for (const match of [...inRound(2), ...inRound(98)]) { match.team1Id = 'TBD'; match.team2Id = 'TBD' }
    inRound(1).forEach((match, storedIndex) => {
      const index = match.bracketPosition ?? storedIndex
      const result = outcome(match); if (!result) return
      const slot: Slot = index === 0 ? 'team1Id' : 'team2Id'
      setSlot(inRound(2)[0], slot, result.winner); setSlot(inRound(98)[0], slot, result.loser)
    })
  }

  if (phase.type === 'upper-lower') {
    const lowerStarters = phase.config.lowerBracketTeamIds ?? []
    const mixedEntry = lowerStarters.length > 0
    for (const match of phaseMatches.filter(match => match.round !== 1)) {
      if (mixedEntry && match.round === -1) {
        match.team1Id = lowerStarters[match.bracketPosition ?? 0] ?? 'TBD'
        match.team2Id = 'TBD'
      } else {
        match.team1Id = 'TBD'
        match.team2Id = 'TBD'
      }
    }
    const route = (round: number, handler: (result: { winner: string; loser: string }, index: number) => void) => inRound(round).forEach((match, storedIndex) => { const result = outcome(match); if (result) handler(result, match.bracketPosition ?? storedIndex) })
    const upperCount = (phase.config.bracketTeamIds?.length ?? 0) - lowerStarters.length
    const upperRounds = Math.log2(upperCount)
    if (mixedEntry) {
      route(1, (r, i) => {
        setSlot(inRound(2)[Math.floor(i / 2)], i % 2 === 0 ? 'team1Id' : 'team2Id', r.winner)
        setSlot(inRound(-1)[i], 'team2Id', r.loser)
      })
      for (let upperRound = 2; upperRound <= upperRounds; upperRound++) {
        const previousLowerRound = -(2 * upperRound - 3)
        const consolidationRound = -(2 * upperRound - 2)
        const injectionRound = consolidationRound - 1
        route(previousLowerRound, (r, i) => setSlot(inRound(consolidationRound)[Math.floor(i / 2)], i % 2 === 0 ? 'team1Id' : 'team2Id', r.winner))
        route(consolidationRound, (r, i) => setSlot(inRound(injectionRound)[i], 'team1Id', r.winner))
        route(upperRound, (r, i) => {
          if (upperRound === upperRounds) setSlot(inRound(99)[0], 'team1Id', r.winner)
          else setSlot(inRound(upperRound + 1)[Math.floor(i / 2)], i % 2 === 0 ? 'team1Id' : 'team2Id', r.winner)
          setSlot(inRound(injectionRound)[i], 'team2Id', r.loser)
        })
        if (upperRound === upperRounds) route(injectionRound, r => setSlot(inRound(99)[0], 'team2Id', r.winner))
      }
    } else {
      route(1, (r, i) => {
        setSlot(inRound(2)[Math.floor(i / 2)], i % 2 === 0 ? 'team1Id' : 'team2Id', r.winner)
        setSlot(inRound(-1)[Math.floor(i / 2)], i % 2 === 0 ? 'team1Id' : 'team2Id', r.loser)
      })
      for (let upperRound = 2; upperRound <= upperRounds; upperRound++) {
        const previousLowerRound = -(2 * upperRound - 3)
        const injectionRound = -(2 * upperRound - 2)
        const consolidationRound = injectionRound - 1
        route(previousLowerRound, (r, i) => setSlot(inRound(injectionRound)[i], 'team2Id', r.winner))
        route(upperRound, (r, i) => {
          if (upperRound === upperRounds) setSlot(inRound(99)[0], 'team1Id', r.winner)
          else setSlot(inRound(upperRound + 1)[Math.floor(i / 2)], i % 2 === 0 ? 'team1Id' : 'team2Id', r.winner)
          setSlot(inRound(injectionRound)[i], 'team1Id', r.loser)
        })
        if (upperRound === upperRounds) {
          route(injectionRound, r => setSlot(inRound(99)[0], 'team2Id', r.winner))
        } else {
          route(injectionRound, (r, i) => setSlot(inRound(consolidationRound)[Math.floor(i / 2)], i % 2 === 0 ? 'team1Id' : 'team2Id', r.winner))
        }
      }
    }
  }
  for (const match of phaseMatches) outcome(match)
  return matches
}

/** Compatibility wrapper for callers that previously advanced one result. */
export function advanceWinner(phase: Phase, allMatches: Match[], _completed: Match): Match[] {
  const matches = allMatches.map(match => ({ ...match }))
  const completed = matches.find(match => match.id === _completed.id)
  if (!completed?.result || !completed.winnerId || completed.result.team1Score === completed.result.team2Score) return matches
  const loser = completed.winnerId === completed.team1Id ? completed.team2Id : completed.team1Id
  const inRound = (round: number) => orderBracketMatches(matches.filter(match => match.phaseId === phase.id && match.round === round))
  const fill = (target: Match | undefined, slot: Slot, teamId: string) => { if (target?.[slot] === 'TBD') target[slot] = teamId }
  const index = inRound(completed.round).findIndex(match => match.id === completed.id)
  if (phase.type === 'elimination') fill(inRound(completed.round + 1)[Math.floor(index / 2)], index % 2 === 0 ? 'team1Id' : 'team2Id', completed.winnerId)
  if (phase.type === 'final-four' && completed.round === 1) {
    const slot: Slot = index === 0 ? 'team1Id' : 'team2Id'; fill(inRound(2)[0], slot, completed.winnerId); fill(inRound(98)[0], slot, loser)
  }
  if (phase.type === 'upper-lower') {
    const lowerStarters = phase.config.lowerBracketTeamIds ?? []
    const mixedEntry = lowerStarters.length > 0
    const upperCount = (phase.config.bracketTeamIds?.length ?? 0) - lowerStarters.length
    const upperRounds = Math.log2(upperCount)

    if (completed.round > 0 && completed.round < 99) {
      if (completed.round < upperRounds) {
        fill(inRound(completed.round + 1)[Math.floor(index / 2)], index % 2 === 0 ? 'team1Id' : 'team2Id', completed.winnerId)
      } else {
        fill(inRound(99)[0], 'team1Id', completed.winnerId)
      }
      const lowerRound = mixedEntry
        ? (completed.round === 1 ? -1 : -(2 * completed.round - 1))
        : (completed.round === 1 ? -1 : -(2 * completed.round - 2))
      const lowerIndex = completed.round === 1 && !mixedEntry ? Math.floor(index / 2) : index
      const lowerSlot: Slot = completed.round === 1
        ? (mixedEntry ? 'team2Id' : (index % 2 === 0 ? 'team1Id' : 'team2Id'))
        : (mixedEntry ? 'team2Id' : 'team1Id')
      fill(inRound(lowerRound)[lowerIndex], lowerSlot, loser)
    } else if (completed.round < 0) {
      const finalLowerRound = mixedEntry ? -(2 * upperRounds - 1) : -(2 * upperRounds - 2)
      if (completed.round === finalLowerRound) {
        fill(inRound(99)[0], 'team2Id', completed.winnerId)
      } else {
        const nextRound = completed.round - 1
        const advancesToPair = mixedEntry ? completed.round % 2 !== 0 : completed.round % 2 === 0
        if (advancesToPair) {
          fill(inRound(nextRound)[Math.floor(index / 2)], index % 2 === 0 ? 'team1Id' : 'team2Id', completed.winnerId)
        } else {
          fill(inRound(nextRound)[index], mixedEntry ? 'team1Id' : 'team2Id', completed.winnerId)
        }
      }
    }
  }
  return matches
}
