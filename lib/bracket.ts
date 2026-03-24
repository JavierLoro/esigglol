import type { Match, Phase } from './types'

/**
 * Dado un partido completado, rellena los slots TBD del siguiente round
 * en el bracket correspondiente. Devuelve el array de matches actualizado.
 *
 * Solo aplica a fases de tipo: elimination, final-four, upper-lower.
 * Groups y swiss no tienen bracket, se ignoran.
 */
export function advanceWinner(
  phase: Phase,
  allMatches: Match[],
  completed: Match,
): Match[] {
  if (!completed.result) return allMatches
  if (!completed.winnerId) return allMatches

  const { team1Score, team2Score } = completed.result
  // En caso de empate no avanzamos automáticamente
  if (team1Score === team2Score) return allMatches

  const winner = completed.winnerId
  const loser = winner === completed.team1Id ? completed.team2Id : completed.team1Id
  const matches = allMatches.map(m => ({ ...m })) // clonar para no mutar

  function fillSlot(target: Match, slot: 'team1Id' | 'team2Id', teamId: string) {
    if (target[slot] === 'TBD') target[slot] = teamId
  }

  function matchesInRound(round: number) {
    return matches.filter(m => m.phaseId === phase.id && m.round === round)
  }

  const round = completed.round
  const phaseMatches = matches.filter(m => m.phaseId === phase.id)

  // ── Eliminación clásica ─────────────────────────────────────────────────
  if (phase.type === 'elimination') {
    const thisRound = phaseMatches.filter(m => m.round === round)
      .sort((a, b) => a.id.localeCompare(b.id))
    const nextRound = phaseMatches.filter(m => m.round === round + 1)
      .sort((a, b) => a.id.localeCompare(b.id))

    const idx = thisRound.findIndex(m => m.id === completed.id)
    if (idx === -1 || nextRound.length === 0) return matches

    const nextMatchIdx = Math.floor(idx / 2)
    const slot: 'team1Id' | 'team2Id' = idx % 2 === 0 ? 'team1Id' : 'team2Id'
    if (nextRound[nextMatchIdx]) fillSlot(nextRound[nextMatchIdx], slot, winner)
  }

  // ── Final Four ──────────────────────────────────────────────────────────
  if (phase.type === 'final-four') {
    if (round === 1) {
      const semis = phaseMatches.filter(m => m.round === 1).sort((a, b) => a.id.localeCompare(b.id))
      const final = phaseMatches.find(m => m.round === 2)
      const thirdPlace = phaseMatches.find(m => m.round === 98)
      const semiIdx = semis.findIndex(m => m.id === completed.id)

      if (final) {
        fillSlot(final, semiIdx === 0 ? 'team1Id' : 'team2Id', winner)
      }
      if (thirdPlace) {
        fillSlot(thirdPlace, semiIdx === 0 ? 'team1Id' : 'team2Id', loser)
      }
    }
  }

  // ── Upper/Lower bracket ─────────────────────────────────────────────────
  if (phase.type === 'upper-lower') {
    const n = phase.config.bracketTeamIds?.length ?? 0

    if (n <= 4) {
      // 4-team: rounds 1 (×2), 2 (×1), -1 (×1), -2 (×1), 99 (×1)
      if (round === 1) {
        const r1 = matchesInRound(1).sort((a, b) => a.id.localeCompare(b.id))
        const r2 = matchesInRound(2)
        const rNeg1 = matchesInRound(-1)
        const idx = r1.findIndex(m => m.id === completed.id)

        if (r2[0]) fillSlot(r2[0], idx === 0 ? 'team1Id' : 'team2Id', winner)
        if (rNeg1[0]) fillSlot(rNeg1[0], idx === 0 ? 'team1Id' : 'team2Id', loser)
      }
      if (round === 2) {
        const r99 = matchesInRound(99)
        const rNeg2 = matchesInRound(-2)
        if (r99[0]) fillSlot(r99[0], 'team1Id', winner)
        if (rNeg2[0]) {
          // Loser of upper final goes to lower final as team1 (faces lower R1 winner)
          if (rNeg2[0].team1Id === 'TBD') fillSlot(rNeg2[0], 'team1Id', loser)
          else fillSlot(rNeg2[0], 'team2Id', loser)
        }
      }
      if (round === -1) {
        const rNeg2 = matchesInRound(-2)
        if (rNeg2[0]) {
          if (rNeg2[0].team1Id === 'TBD') fillSlot(rNeg2[0], 'team1Id', winner)
          else fillSlot(rNeg2[0], 'team2Id', winner)
        }
      }
      if (round === -2) {
        const r99 = matchesInRound(99)
        if (r99[0]) fillSlot(r99[0], 'team2Id', winner)
      }
    } else {
      // 8-team: rounds 1 (×4), 2 (×2), 3 (×1), -1 (×2), -2 (×2), -3 (×1), -4 (×1), 99 (×1)
      if (round === 1) {
        const r1 = matchesInRound(1).sort((a, b) => a.id.localeCompare(b.id))
        const r2 = matchesInRound(2).sort((a, b) => a.id.localeCompare(b.id))
        const rNeg1 = matchesInRound(-1).sort((a, b) => a.id.localeCompare(b.id))
        const idx = r1.findIndex(m => m.id === completed.id)

        if (r2[Math.floor(idx / 2)]) fillSlot(r2[Math.floor(idx / 2)], idx % 2 === 0 ? 'team1Id' : 'team2Id', winner)
        if (rNeg1[Math.floor(idx / 2)]) fillSlot(rNeg1[Math.floor(idx / 2)], idx % 2 === 0 ? 'team1Id' : 'team2Id', loser)
      }
      if (round === 2) {
        const r2 = matchesInRound(2).sort((a, b) => a.id.localeCompare(b.id))
        const r3 = matchesInRound(3)
        const rNeg2 = matchesInRound(-2).sort((a, b) => a.id.localeCompare(b.id))
        const idx = r2.findIndex(m => m.id === completed.id)

        if (r3[0]) fillSlot(r3[0], idx === 0 ? 'team1Id' : 'team2Id', winner)
        if (rNeg2[idx]) {
          if (rNeg2[idx].team1Id === 'TBD') fillSlot(rNeg2[idx], 'team1Id', loser)
          else fillSlot(rNeg2[idx], 'team2Id', loser)
        }
      }
      if (round === 3) {
        const r99 = matchesInRound(99)
        const rNeg3 = matchesInRound(-3)
        if (r99[0]) fillSlot(r99[0], 'team1Id', winner)
        if (rNeg3[0]) {
          if (rNeg3[0].team1Id === 'TBD') fillSlot(rNeg3[0], 'team1Id', loser)
          else fillSlot(rNeg3[0], 'team2Id', loser)
        }
      }
      if (round === -1) {
        const rNeg1 = matchesInRound(-1).sort((a, b) => a.id.localeCompare(b.id))
        const rNeg2 = matchesInRound(-2).sort((a, b) => a.id.localeCompare(b.id))
        const idx = rNeg1.findIndex(m => m.id === completed.id)
        if (rNeg2[idx]) {
          if (rNeg2[idx].team1Id === 'TBD') fillSlot(rNeg2[idx], 'team1Id', winner)
          else fillSlot(rNeg2[idx], 'team2Id', winner)
        }
      }
      if (round === -2) {
        const rNeg2 = matchesInRound(-2).sort((a, b) => a.id.localeCompare(b.id))
        const rNeg3 = matchesInRound(-3)
        const idx = rNeg2.findIndex(m => m.id === completed.id)
        if (rNeg3[0]) {
          if (idx === 0) {
            if (rNeg3[0].team1Id === 'TBD') fillSlot(rNeg3[0], 'team1Id', winner)
            else fillSlot(rNeg3[0], 'team2Id', winner)
          } else {
            if (rNeg3[0].team1Id === 'TBD') fillSlot(rNeg3[0], 'team1Id', winner)
            else fillSlot(rNeg3[0], 'team2Id', winner)
          }
        }
      }
      if (round === -3) {
        const rNeg4 = matchesInRound(-4)
        if (rNeg4[0]) {
          if (rNeg4[0].team1Id === 'TBD') fillSlot(rNeg4[0], 'team1Id', winner)
          else fillSlot(rNeg4[0], 'team2Id', winner)
        }
      }
      if (round === -4) {
        const r99 = matchesInRound(99)
        if (r99[0]) fillSlot(r99[0], 'team2Id', winner)
      }
    }
  }

  return matches
}
