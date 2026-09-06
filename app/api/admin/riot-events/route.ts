import { requireAdminSession } from '@/lib/auth'
import { subscribeToRiotResults, type RiotResultEvent } from '@/lib/riot-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const denied = await requireAdminSession()
  if (denied) return denied

  const encoder = new TextEncoder()
  let unsubscribe = () => {}
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      send('ready', { connectedAt: new Date().toISOString() })
      unsubscribe = subscribeToRiotResults((event: RiotResultEvent) => send('riot-result', event))
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')) } catch { cleanup() }
      }, 25_000)

      request.signal.addEventListener('abort', cleanup, { once: true })

      function cleanup() {
        unsubscribe()
        if (heartbeat) clearInterval(heartbeat)
        try { controller.close() } catch { /* already closed by the client */ }
      }
    },
    cancel() {
      unsubscribe()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
