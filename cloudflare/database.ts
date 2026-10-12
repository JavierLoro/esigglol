import type { DatabaseContract, SqlStatement } from '../lib/database-contract'

function bindings(parameters: unknown[]): SqlStorageValue[] {
  return parameters.map(value => {
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer
    if (value === null || typeof value === 'string' || typeof value === 'number' || value instanceof ArrayBuffer) return value
    throw new TypeError('Unsupported SQL binding')
  })
}

export function createDatabase(storage: DurableObjectStorage): DatabaseContract {
  return {
    prepare(sql): SqlStatement {
      return {
        all(...parameters) { return storage.sql.exec(sql, ...bindings(parameters)).toArray() },
        get(...parameters) { return storage.sql.exec(sql, ...bindings(parameters)).toArray()[0] },
        run(...parameters) {
          // A deletion tombstone must reject new references while R2 I/O yields.
          if (/^\s*(INSERT|UPDATE|REPLACE)\b/i.test(sql) && /\b(teams|team_change_requests|tournament_config)\b/i.test(sql)) {
            for (const parameter of parameters) {
              if (typeof parameter !== 'string' || !parameter.startsWith('{')) continue
              let logo: unknown
              try { logo = (JSON.parse(parameter) as { logo?: unknown }).logo } catch { continue }
              if (typeof logo !== 'string' || !logo.startsWith('/api/uploads/')) continue
              const row = storage.sql.exec<{ state: string }>('SELECT state FROM cloudflare_files WHERE name=?', logo.slice('/api/uploads/'.length)).toArray()[0]
              if (row && row.state !== 'live') throw new Error('Logo is unavailable; upload it again')
            }
          }
          // Consume the cursor before reading SQLite's connection-local counters.
          storage.sql.exec(sql, ...bindings(parameters)).toArray()
          const row = storage.sql.exec<{ changes: number; id: number }>('SELECT changes() AS changes, last_insert_rowid() AS id').one()
          return { changes: row.changes, lastInsertRowid: row.id }
        },
      }
    },
    exec(sql) { storage.sql.exec(sql).toArray() },
    transaction(callback) {
      const transaction = (...args: Parameters<typeof callback>): ReturnType<typeof callback> => storage.transactionSync(() => {
        const result = callback(...args)
        if (result instanceof Promise) throw new TypeError('SQL transactions must be synchronous')
        return result
      })
      return Object.assign(transaction, { immediate: transaction })
    },
  }
}
