import db from './db'
type Labels = { method: string; route: string; status_code: string }
function record(labels: Labels, seconds: number) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM cloudflare_http_metrics').get() as { n: number }
  if (count.n >= 1024 && !db.prepare('SELECT 1 FROM cloudflare_http_metrics WHERE method=? AND route=? AND status=?').get(labels.method, labels.route, labels.status_code)) return
  db.prepare(`INSERT INTO cloudflare_http_metrics (method, route, status, count, seconds) VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(method, route, status) DO UPDATE SET count=count+1, seconds=seconds+excluded.seconds`)
    .run(labels.method, labels.route, labels.status_code, seconds)
}
export const httpRequestDuration = { observe(labels: Labels, seconds: number) { record(labels, seconds) } }
// The paired observe call above already increments the durable request counter.
export const httpRequestsTotal = { inc(_labels: Labels) { void _labels } }
export const register = {
  contentType: 'text/plain; version=0.0.4; charset=utf-8',
  async metrics() {
    const rows = db.prepare('SELECT * FROM cloudflare_http_metrics').all() as Array<Labels & { status: string; count: number; seconds: number }>
    return rows.flatMap(row => {
      const labels = `method=${JSON.stringify(row.method)},route=${JSON.stringify(row.route)},status_code=${JSON.stringify(row.status)}`
      return [`http_requests_total{${labels}} ${row.count}`, `http_request_duration_seconds_sum{${labels}} ${row.seconds}`, `http_request_duration_seconds_count{${labels}} ${row.count}`]
    }).join('\n') + '\n'
  },
}
