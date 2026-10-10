export interface SqlStatement {
  run(...parameters: unknown[]): { changes: number; lastInsertRowid: number | bigint }
  get(...parameters: unknown[]): unknown
  all(...parameters: unknown[]): unknown[]
}

export interface SqlTransaction<Args extends unknown[], Result> {
  (...args: Args): Result
  immediate(...args: Args): Result
}

// Both implementations execute callbacks synchronously in a real SQL transaction.
export interface DatabaseContract {
  prepare(sql: string): SqlStatement
  exec(sql: string): void
  transaction<Args extends unknown[], Result>(callback: (...args: Args) => Result): SqlTransaction<Args, Result>
}
