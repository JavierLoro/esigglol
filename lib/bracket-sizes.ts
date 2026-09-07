import type { PhaseType } from './types'

/** Supported team counts for every format. `null` means any count >= 2. */
export const BRACKET_SIZES: Record<PhaseType, readonly number[] | null> = {
  groups: null,
  swiss: [8, 16],
  elimination: [2, 4, 8, 16, 32],
  'final-four': [4],
  'upper-lower': [4, 8],
}

export function bracketSizeError(type: PhaseType, count: number): string | null {
  if (!Number.isInteger(count) || count < 2) return 'Se necesitan al menos 2 equipos.'
  const supported = BRACKET_SIZES[type]
  if (supported === null) return null
  if (supported.includes(count)) return null
  if (type === 'elimination') {
    return `Eliminación clásica admite ${supported.join(', ')} equipos (potencias de dos); ${count} no es válido.`
  }
  const label = type === 'final-four' ? 'Final Four' : type === 'upper-lower' ? 'Upper/Lower' : 'Formato Suizo'
  return `${label} requiere exactamente ${supported.join(' u ')} equipos.`
}

