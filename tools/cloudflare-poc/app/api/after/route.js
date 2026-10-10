import { env } from 'cloudflare:workers'

export async function GET() {
  const object = await env.FILES.get('probe-after.txt')
  return Response.json({ completed: object ? await object.text() === 'completed' : false })
}
