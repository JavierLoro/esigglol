export function isTeamSelectionAllowed(teamId: string, otherTeamId: string): boolean {
  return teamId !== otherTeamId
}
