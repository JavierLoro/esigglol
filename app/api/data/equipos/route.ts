import { NextResponse } from 'next/server'
import { getTeams } from '@/lib/data'

export async function GET() {
  const teams = getTeams()
  const res = NextResponse.json(teams)
  res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  return res
}
