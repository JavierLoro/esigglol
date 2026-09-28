import { getTwitchStatus } from '@/lib/twitch'
import { getSiteBranding } from '@/lib/site-branding'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getTwitchStatus(getSiteBranding().channel)
  return Response.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
