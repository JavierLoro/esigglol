import { env } from 'cloudflare:workers'
import { pilotFiles, withR2Budget } from '../../../lib/r2-budget.mjs'

// These operations are diagnostic fixtures, not persistence adapters for esigglol.
export async function POST(request) {
  return withR2Budget(async () => {
    const files = pilotFiles(env)
    const { operation } = await request.json()
    if (operation === 'reset') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM probe_records'),
        env.DB.prepare("INSERT INTO probe_records (id, value) VALUES ('cas', 'initial')"),
      ])
      return Response.json({ reset: true })
    }
    if (operation === 'rollback') {
      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO probe_records (id, value) VALUES ('rollback', 'must-not-survive')"),
          env.DB.prepare("INSERT INTO probe_records (id, value) VALUES ('cas', 'duplicate-primary-key')"),
        ])
        return Response.json({ error: 'Expected constraint failure' }, { status: 500 })
      } catch {
        const row = await env.DB.prepare("SELECT id FROM probe_records WHERE id = 'rollback'").first()
        return Response.json({ rolledBack: row === null })
      }
    }
    if (operation === 'cas') {
      const result = await env.DB.prepare("UPDATE probe_records SET version = version + 1 WHERE id = 'cas' AND version = 0").run()
      return Response.json({ changed: result.meta.changes }, { status: result.meta.changes === 1 ? 200 : 409 })
    }
    if (['write-file', 'delete-file', 'delete-after'].includes(operation) && !env.FILES) {
      return Response.json({ error: 'R2 not configured' }, { status: 503 })
    }
    if (operation === 'write-file') {
      await files.put('probe-object.txt', 'r2-round-trip', { httpMetadata: { contentType: 'text/plain' } })
      return Response.json({ written: true })
    }
    if (operation === 'delete-file') {
      await files.delete('probe-object.txt')
      return Response.json({ deleted: true })
    }
    if (operation === 'delete-after') {
      await files.delete('probe-after.txt')
      return Response.json({ deleted: true })
    }
    return Response.json({ error: 'Unknown operation' }, { status: 400 })
  })
}

export async function GET() {
  return withR2Budget(async () => {
    if (!env.FILES) return Response.json({ error: 'R2 not configured' }, { status: 503 })
    const object = await pilotFiles(env).get('probe-object.txt')
    if (!object) return new Response(null, { status: 404 })
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('ETag', object.httpEtag)
    return new Response(object.body, { headers })
  })
}
