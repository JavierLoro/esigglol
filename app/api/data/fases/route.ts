import { NextResponse } from 'next/server'
import { getPhases, getMatches } from '@/lib/data'

const BRACKET_TYPES = new Set(['elimination', 'final-four', 'upper-lower'])

export async function GET() {
  const phases = getPhases()
  const allMatches = getMatches()
  const matches = allMatches.filter(m => {
    const phase = phases.find(p => p.id === m.phaseId)
    if (!phase) return false
    if (BRACKET_TYPES.has(phase.type)) return phase.config.confirmedBracket === true
    return true
  })
  const res = NextResponse.json({ phases, matches })
  res.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
  return res
}
