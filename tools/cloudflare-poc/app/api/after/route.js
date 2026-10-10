import { env } from 'cloudflare:workers'
import { pilotFiles, withR2Budget } from '../../../lib/r2-budget.mjs'

export async function GET() {
  return withR2Budget(async () => {
    if (!env.FILES) return Response.json({ error: 'R2 not configured' }, { status: 503 })
    const object = await pilotFiles(env).get('probe-after.txt')
    return Response.json({ completed: object ? await object.text() === 'completed' : false })
  })
}
