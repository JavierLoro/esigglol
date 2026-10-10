import { timingSafeEqual } from 'node:crypto'

export const PILOT_REQUEST_LIMIT = 1000
export const RESERVE_REQUEST = `INSERT INTO pilot_budget (id, requests) VALUES ('pilot', 1)
  ON CONFLICT(id) DO UPDATE SET requests = requests + 1
  WHERE requests < ${PILOT_REQUEST_LIMIT} RETURNING requests`

// Every path, including assets and the diagnostic session issuer, is private.
export function protectWorker(worker) {
  return {
    async fetch(request, env, ctx) {
      const expires = Date.parse(env.PROBE_EXPIRES_AT ?? '')
      if (!env.PROBE_ACCESS_TOKEN || env.PROBE_ACCESS_TOKEN.length < 32 || !Number.isFinite(expires) || Date.now() >= expires) {
        return Response.json({ error: 'Pilot unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
      const provided = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
      const encoder = new TextEncoder()
      const [actual, expected] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(provided)),
        crypto.subtle.digest('SHA-256', encoder.encode(env.PROBE_ACCESS_TOKEN)),
      ])
      if (!timingSafeEqual(new Uint8Array(actual), new Uint8Array(expected))) {
        return Response.json({ error: 'Unauthorized' }, {
          status: 401, headers: { 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer' },
        })
      }
      // A persistent, atomic ceiling survives isolates and deployments. It bounds
      // fixture dispatch/R2 work, not account billing or rejected D1 queries.
      let reserved
      try {
        reserved = await env.DB.prepare(RESERVE_REQUEST).first()
      } catch {
        return Response.json({ error: 'Pilot budget unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
      if (!reserved) {
        return Response.json({ error: 'Pilot request limit reached' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
      }
      // Do not pass the diagnostic credential to framework rendering or logging.
      const headers = new Headers(request.headers)
      headers.delete('Authorization')
      const response = await worker.fetch(new Request(request, { headers }), env, ctx)
      const privateResponse = new Response(response.body, response)
      privateResponse.headers.set('Cache-Control', 'private, no-store')
      privateResponse.headers.set('X-Content-Type-Options', 'nosniff')
      return privateResponse
    },
  }
}
