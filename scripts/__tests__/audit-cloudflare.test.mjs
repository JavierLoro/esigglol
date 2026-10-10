import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspectSource, resolveLocal, collectDependencies } from '../audit-cloudflare.mjs'

test('records native IO, nested transactions and deferred work with source locations', () => {
  const { evidence } = inspectSource('lib/example.ts', `import db from './db'
import { unlinkSync } from 'node:fs'
db.transaction(() => db.transaction(() => db.prepare('DELETE FROM teams').run()).immediate()).immediate()
after(() => setTimeout(() => {}, 1000))`)
  assert.ok(evidence.some(item => item.kind === 'filesystem' && item.line === 2))
  assert.ok(evidence.some(item => item.kind === 'nested-transaction' && item.line === 3))
  assert.ok(evidence.some(item => item.kind === 'sql-text'))
  assert.equal(evidence.filter(item => item.kind === 'deferred-work').length, 2)
})

test('follows literal dynamic imports and re-exports but ignores type-only imports', () => {
  const { imports } = inspectSource('lib/auth.ts', `import type Database from 'better-sqlite3'
import { type Team } from './types'
export { getTeams } from './data'
const load = () => import('./team-portal-data')`)
  assert.deepEqual(imports, ['./data', './team-portal-data'])
  assert.equal(resolveLocal('app/api/team/route.ts', '@/lib/auth', new Set(['lib/auth.ts'])), 'lib/auth.ts')
})

test('propagates blockers through cycles without infinite recursion', () => {
  const modules = new Map([
    ['app/page.tsx', { dependencies: ['lib/auth.ts'] }],
    ['lib/auth.ts', { dependencies: ['lib/data.ts'] }],
    ['lib/data.ts', { dependencies: ['lib/auth.ts', 'lib/db.ts'] }],
    ['lib/db.ts', { dependencies: [] }],
  ])
  assert.deepEqual([...collectDependencies('app/page.tsx', modules)].sort(), [...modules.keys()].sort())
})
