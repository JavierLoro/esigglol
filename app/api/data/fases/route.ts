import { NextResponse } from 'next/server'
import { getPhases, getMatches } from '@/lib/data'

export async function GET() {
  const phases = getPhases()
  const matches = getMatches()
  const res = NextResponse.json({ phases, matches })
  res.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
  return res
}
