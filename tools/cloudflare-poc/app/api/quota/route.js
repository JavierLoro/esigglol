import { env } from 'cloudflare:workers'
import { readR2Budget, withR2Budget } from '../../../lib/r2-budget.mjs'

// Private diagnostic status; this endpoint does not invoke R2.
export function GET() {
  return withR2Budget(async () => Response.json(await readR2Budget(env.DB)))
}
