import { getTwitchStatus } from '@/lib/twitch'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getTwitchStatus()
  return Response.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
