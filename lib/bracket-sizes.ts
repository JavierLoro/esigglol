import type { PhaseType } from './types'

/** Fixed team counts for each format. `null` means the format uses dynamic validation. */
export const BRACKET_SIZES: Record<PhaseType, readonly number[] | null> = {
  groups: null,
  swiss: [8, 16],
  elimination: [2, 4, 8, 16, 32],
  'final-four': [4],
  'upper-lower': null,
}

export function isPowerOfTwoAtLeastFour(count: number): boolean {
  return Number.isInteger(count) && count >= 4 && Number.isInteger(Math.log2(count))
}

export function bracketSizeError(type: PhaseType, count: number): string | null {
  if (!Number.isInteger(count) || count < 2) return 'Se necesitan al menos 2 equipos.'
  if (type === 'upper-lower') {
    const upperCountForSplit = count * 2 / 3
    if (isPowerOfTwoAtLeastFour(count) || isPowerOfTwoAtLeastFour(upperCountForSplit)) return null
    return 'Upper/Lower admite todos los equipos en Upper (4, 8, 16...) o un reparto 2:1 (4+2, 8+4, 16+8...).'
  }
  const supported = BRACKET_SIZES[type]
  if (supported === null) return null
  if (supported.includes(count)) return null
  if (type === 'elimination') {
    return `Eliminación clásica admite ${supported.join(', ')} equipos (potencias de dos); ${count} no es válido.`
  }
  const label = type === 'final-four' ? 'Final Four' : 'Formato Suizo'
  return `${label} requiere exactamente ${supported.join(' u ')} equipos.`
}

