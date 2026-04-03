import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf-8')
}

describe('public pages rendering strategy', () => {
  const pages = [
    'app/fases/page.tsx',
    'app/ranking/page.tsx',
    'app/comparar/page.tsx',
  ]

  it.each(pages)('%s uses ISR with revalidate=60', (page) => {
    const source = read(page)
    expect(source).toMatch(/^\s*export const revalidate = 60\b/m)
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
  })
})
