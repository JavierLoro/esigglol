import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadLocalEnv } from '../load-env'

const tempDirectories: string[] = []

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function envFile(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'esigglol-env-'))
  tempDirectories.push(directory)
  const filePath = join(directory, '.env.local')
  writeFileSync(filePath, contents)
  return filePath
}

describe('loadLocalEnv', () => {
  it('loads local values without overriding system values', () => {
    const target: NodeJS.ProcessEnv = { NODE_ENV: 'development', EXISTING: 'system' }

    expect(loadLocalEnv(target, envFile('EXISTING=file\nLOCAL=value\n'))).toBe(true)
    expect(target).toMatchObject({ EXISTING: 'system', LOCAL: 'value' })
  })

  it('does not read a local file in production', () => {
    const target: NodeJS.ProcessEnv = { NODE_ENV: 'production' }

    expect(loadLocalEnv(target, envFile('SESSION_SECRET=must-not-load\n'))).toBe(false)
    expect(target).not.toHaveProperty('SESSION_SECRET')
  })
})
