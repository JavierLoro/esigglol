/**
 * Riot Match-v5 IDs are made of a platform identifier, an underscore, and
 * the numeric match ID (for example, EUW1_7123456789).
 *
 * Keep this rule independent of the server so the admin form and its API
 * endpoint reject exactly the same values.
 */
export const RIOT_MATCH_ID_PATTERN = /^[A-Z0-9]{2,6}_[0-9]+$/
export const RIOT_MATCH_ID_ERROR = 'El ID de partida debe tener el formato EUW1_123456789'

export function normalizeRiotMatchId(value: string): string {
  return value.trim().toUpperCase()
}

export function isValidRiotMatchId(value: string): boolean {
  return RIOT_MATCH_ID_PATTERN.test(normalizeRiotMatchId(value))
}
