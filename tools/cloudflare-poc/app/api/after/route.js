import { env } from 'cloudflare:workers'

export async function GET() {
  if (!env.FILES) return Response.json({ error: 'R2 not configured' }, { status: 503 })
  const object = await env.FILES.get('probe-after.txt')
  return Response.json({ completed: object ? await object.text() === 'completed' : false })
}
