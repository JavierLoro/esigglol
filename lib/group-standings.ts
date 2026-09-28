import type { Match } from './types'

export interface Standing {
  teamId: string
  wins: number
  losses: number
  points: number
}

export function getGroupStandings(teamIds: string[], matches: Match[]): Standing[] {
  const standings: Record<string, Standing> = {}
  for (const id of teamIds) {
    standings[id] = { teamId: id, wins: 0, losses: 0, points: 0 }
  }
  for (const m of matches) {
    if (!m.result) continue
    if (!teamIds.includes(m.team1Id) || !teamIds.includes(m.team2Id)) continue
    const { team1Score, team2Score } = m.result
    if (team1Score > team2Score) {
      standings[m.team1Id].wins++
      standings[m.team1Id].points += 3
      standings[m.team2Id].losses++
    } else if (team1Score === team2Score) {
      standings[m.team1Id].points += 1
      standings[m.team2Id].points += 1
    } else {
      standings[m.team2Id].wins++
      standings[m.team2Id].points += 3
      standings[m.team1Id].losses++
    }
  }
  return Object.values(standings).sort((a, b) => b.points - a.points || b.wins - a.wins)
}
